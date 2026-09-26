import { 
  Interaction, 
  Events, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  TextChannel,
  GuildMember, 
  EmbedBuilder,
  Guild 
} from 'discord.js';
import bot from '../client';
import { RecruitmentService } from '../modules/recruitment/recruitmentService';
import { EventService } from '../modules/events/eventService';
import { AcademyService } from '../modules/academy/academyService';
import { ProfileService } from '../modules/profiles/profileService';
import { LeaveService } from '../modules/leave/leaveService';
import { NicknameService } from '../modules/nicknames/nicknameService';
import { TierService } from '../modules/tier/tierService';
import prisma from '../../database/client';
import { THEME, createThemedEmbed } from '../utils/theme';

let isInteractionHandlerRegistered = false;

async function resolveGuild(interaction: { guild?: Guild | null; guildId?: string | null }): Promise<Guild | null> {
  if (interaction.guild) return interaction.guild;
  const guildId = interaction.guildId;
  if (!guildId) return null;
  return bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
}

export function registerInteractionHandler() {
  if (isInteractionHandlerRegistered) return;
  isInteractionHandlerRegistered = true;

  bot.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      // 1. Slash commands
      if (interaction.isChatInputCommand()) {
        const command = bot.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
        return;
      }

      // 2. Buttons
      if (interaction.isButton()) {
        const customId = interaction.customId;
        const guild = await resolveGuild(interaction);
        const member = interaction.member as GuildMember;
        if (member && !member.guild && guild) {
          (member as any).guild = guild;
        }

        // --- Academy Buttons ---
        if (customId === 'academy_submit_report_btn') {
          const modal = new ModalBuilder()
            .setCustomId('academy_report_modal')
            .setTitle('Сдача отчета по МП');

          const mpTypeInput = new TextInputBuilder()
            .setCustomId('report_mp_type')
            .setLabel('Тип мероприятия')
            .setPlaceholder('например: Капт, ВЗЗ, МЦЛ')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const screenshotsInput = new TextInputBuilder()
            .setCustomId('report_screenshots')
            .setLabel('Ссылка(и) на скриншоты')
            .setPlaceholder('https://imgur.com/... или ссылка на скрин в Discord')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          const commentInput = new TextInputBuilder()
            .setCustomId('report_comment')
            .setLabel('Комментарий / примечание')
            .setPlaceholder('Количество киллов / время участия (опционально)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(mpTypeInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(screenshotsInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput)
          );

          await interaction.showModal(modal);
          return;
        }

        if (customId === 'academy_check_progress_btn') {
          const academy = await prisma.academyChannel.findFirst({
            where: { channelId: interaction.channelId!, status: 'ACTIVE' },
          });

          if (!academy) {
            await interaction.reply({ content: '❌ Данные академии не найдены.', ephemeral: true });
            return;
          }

          const neededTotal = academy.requiredMp + academy.penaltyMp;
          const remaining = Math.max(0, neededTotal - academy.approvedMpCount);

          const progressEmbed = createThemedEmbed({
            title: 'ПРОГРЕСС В АКАДЕМИИ',
            color: remaining === 0 ? THEME.COLORS.SUCCESS : THEME.COLORS.PRIMARY,
            description: [
              THEME.format.quote('Текущая статистика выполнения нормативов академии.'),
              '',
              THEME.format.item('Подтверждено МП', THEME.format.code(`${academy.approvedMpCount} / ${neededTotal}`)),
              THEME.format.item('Штрафные МП', THEME.format.code(`${academy.penaltyMp}`)),
              THEME.format.item('Осталось сдать', THEME.format.code(`${remaining} МП`)),
              '',
              THEME.format.progressBar(academy.approvedMpCount, neededTotal),
              '',
              remaining === 0
                ? THEME.format.bold('Норма выполнена. Ожидайте аттестации рекрутером.')
                : THEME.format.subtext('Посещайте мероприятия семьи и сдавайте отчеты в этом канале.'),
            ].join('\n'),
            footerText: 'INTERPOL Academy • Личный прогресс',
          });

          await interaction.reply({ embeds: [progressEmbed], ephemeral: true });
          return;
        }

        if (customId.startsWith('academy_approve_report_') || customId.startsWith('academy_report_approve_')) {
          const reportId = customId.startsWith('academy_report_approve_')
            ? customId.replace('academy_report_approve_', '')
            : customId.replace('academy_approve_report_', '');
          await interaction.deferReply();
          try {
            await AcademyService.reviewReport(reportId, member, true);
            await interaction.editReply({ content: `✅ Отчет #${reportId} успешно одобрен рекрутером ${member}.` });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка: ${err.message}` });
          }
          return;
        }

        if (customId.startsWith('academy_reject_report_') || customId.startsWith('academy_report_reject_')) {
          const reportId = customId.startsWith('academy_report_reject_')
            ? customId.replace('academy_report_reject_', '')
            : customId.replace('academy_reject_report_', '');
          const modal = new ModalBuilder()
            .setCustomId(`academy_reject_modal_${reportId}`)
            .setTitle('Отклонение отчета по МП');

          const reasonInput = new TextInputBuilder()
            .setCustomId('reject_reason')
            .setLabel('Причина отказа')
            .setPlaceholder('например: Нет худа / не видно дату / чужой скриншот')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
          await interaction.showModal(modal);
          return;
        }

        if (customId.startsWith('academy_promote_confirm_') || customId.startsWith('academy_promo_confirm_') || (customId.startsWith('academy_promote_') && !customId.startsWith('academy_promote_reject_') && !customId.startsWith('academy_promo_reject_'))) {
          const academyChannelId = customId.startsWith('academy_promote_confirm_')
            ? customId.replace('academy_promote_confirm_', '')
            : customId.startsWith('academy_promo_confirm_')
            ? customId.replace('academy_promo_confirm_', '')
            : customId.replace('academy_promote_', '');
          await interaction.deferReply();
          try {
            await AcademyService.promoteAcademician(academyChannelId, member, true);
            await interaction.editReply({ content: `🎖️ Академик успешно повышен на 2 ранг рекрутером ${member}!` });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка: ${err.message}` });
          }
          return;
        }

        if (customId.startsWith('academy_promote_reject_') || customId.startsWith('academy_promo_reject_')) {
          const academyChannelId = customId.startsWith('academy_promote_reject_')
            ? customId.replace('academy_promote_reject_', '')
            : customId.replace('academy_promo_reject_', '');
          const modal = new ModalBuilder()
            .setCustomId(`academy_promo_reject_modal_${academyChannelId}`)
            .setTitle('Отклонение повышения');

          const reasonInput = new TextInputBuilder()
            .setCustomId('promo_reject_reason')
            .setLabel('Причина отказа в повышении')
            .setPlaceholder('например: Нарушение правил / недостаточная активность')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          const penaltyInput = new TextInputBuilder()
            .setCustomId('promo_penalty_count')
            .setLabel('Количество штрафных МП')
            .setValue('2')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(penaltyInput)
          );

          await interaction.showModal(modal);
          return;
        }

        // --- Recruitment Buttons ---
        if (customId === 'recruit_apply_button') {
          const modal = await RecruitmentService.buildApplicationModal(interaction.guildId!);
          await interaction.showModal(modal);
          return;
        }

        if (customId.startsWith('recruit_claim_')) {
          const applicationId = customId.replace('recruit_claim_', '');
          await RecruitmentService.handleClaim(interaction, applicationId);
          return;
        }

        if (customId.startsWith('recruit_approve_')) {
          const applicationId = customId.replace('recruit_approve_', '');
          await RecruitmentService.handleApprove(interaction, applicationId);
          return;
        }

        if (customId.startsWith('recruit_interview_')) {
          const applicationId = customId.replace('recruit_interview_', '');
          await RecruitmentService.handleInterview(interaction, applicationId);
          return;
        }

        if (customId.startsWith('recruit_reject_')) {
          const applicationId = customId.replace('recruit_reject_', '');
          await RecruitmentService.promptRejectModal(interaction, applicationId);
          return;
        }

        // --- Event Buttons ---
        if (customId.startsWith('event_join_') || customId.startsWith('event_confirm_')) {
          const eventId = customId.startsWith('event_confirm_')
            ? customId.replace('event_confirm_', '')
            : customId.replace('event_join_', '');
          await EventService.handleJoin(interaction, eventId, false);
          return;
        }

        if (customId.startsWith('event_reserve_')) {
          const eventId = customId.replace('event_reserve_', '');
          await EventService.handleJoin(interaction, eventId, true);
          return;
        }

        if (customId.startsWith('event_leave_')) {
          const eventId = customId.replace('event_leave_', '');
          await EventService.handleLeave(interaction, eventId);
          return;
        }

        if (customId.startsWith('event_manage_')) {
          const eventId = customId.replace('event_manage_', '');
          await EventService.promptManagement(interaction, eventId);
          return;
        }

        // --- Tier System Buttons ---
        if (customId === 'tier_request_channel_btn') {
          await TierService.handleRequestChannel(interaction);
          return;
        }

        if (customId.startsWith('tier_clip_btn_')) {
          const raw = customId.replace('tier_clip_btn_', '');
          const lastUnderscore = raw.lastIndexOf('_');
          const mpType = decodeURIComponent(raw.substring(0, lastUnderscore));
          const ticketId = raw.substring(lastUnderscore + 1);
          await TierService.handleSubmitClipButton(interaction, mpType, ticketId);
          return;
        }

        if (customId.startsWith('tier_review_btn_')) {
          const submissionId = customId.replace('tier_review_btn_', '');
          await TierService.handleReviewButton(interaction, submissionId);
          return;
        }

        // --- Panel Buttons (Profiles & Leaves) ---
        if (customId === 'panel_bind_static') {
          const modal = new ModalBuilder()
            .setCustomId('modal_bind_static')
            .setTitle('Привязка Majestic Static ID');

          const staticInput = new TextInputBuilder()
            .setCustomId('static_id')
            .setLabel('Ваш Static ID')
            .setPlaceholder('например: 123456')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const charNameInput = new TextInputBuilder()
            .setCustomId('character_name')
            .setLabel('Имя персонажа (IC Nickname)')
            .setPlaceholder('например: Alex Interpol')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(staticInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(charNameInput)
          );

          await interaction.showModal(modal);
          return;
        }

        if (customId === 'panel_request_leave' || customId === 'panel_request_vacation') {
          const modal = new ModalBuilder()
            .setCustomId('modal_request_leave')
            .setTitle('Заявка на отпуск (от 1 до 14 дней)');

          const startInput = new TextInputBuilder()
            .setCustomId('leave_start_date')
            .setLabel('Дата начала (ДД.ММ.ГГГГ)')
            .setPlaceholder('например: 25.09.2026')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const endInput = new TextInputBuilder()
            .setCustomId('leave_end_date')
            .setLabel('Дата окончания (ДД.ММ.ГГГГ)')
            .setPlaceholder('например: 05.10.2026')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId('leave_reason')
            .setLabel('Причина отпуска')
            .setPlaceholder('например: Работа / сессия / отъезд')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(startInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(endInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
          );

          await interaction.showModal(modal);
          return;
        }

        if (customId === 'panel_request_timeoff') {
          const modal = new ModalBuilder()
            .setCustomId('modal_request_timeoff')
            .setTitle('Заявка на отгул (5 мин - 24 ч)');

          const durationInput = new TextInputBuilder()
            .setCustomId('timeoff_duration')
            .setLabel('Длительность (например: 2 часа, 30 мин, 8ч)')
            .setPlaceholder('например: 2ч или 45м или 4 часа')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId('timeoff_reason')
            .setLabel('Причина отгула')
            .setPlaceholder('например: Личные дела / ремонт ПК / учеба')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
          );

          await interaction.showModal(modal);
          return;
        }

        if (customId.startsWith('leave_approve_')) {
          const leaveId = customId.replace('leave_approve_', '');
          await interaction.deferReply();
          try {
            const isLeaderOrAdmin = member.permissions && typeof member.permissions.has === 'function'
              ? (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild))
              : false;
            if (!isLeaderOrAdmin) {
              await interaction.editReply({ content: '❌ Только руководство может одобрять отпуска.' });
              return;
            }
            await LeaveService.reviewLeave(leaveId, member.id, member.user.tag, true);
            await interaction.editReply({ content: `✅ Заявка на отпуск одобрена руководителем ${member}.` });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка: ${err.message}` });
          }
          return;
        }

        if (customId.startsWith('leave_reject_')) {
          const leaveId = customId.replace('leave_reject_', '');
          await interaction.deferReply();
          try {
            const isLeaderOrAdmin = member.permissions && typeof member.permissions.has === 'function'
              ? (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild))
              : false;
            if (!isLeaderOrAdmin) {
              await interaction.editReply({ content: '❌ Только руководство может отклонять отпуска.' });
              return;
            }
            await LeaveService.reviewLeave(leaveId, member.id, member.user.tag, false, 'Отклонено руководством');
            await interaction.editReply({ content: `❌ Заявка на отпуск отклонена руководителем ${member}.` });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка: ${err.message}` });
          }
          return;
        }
      }

      // 3. Modals
      if (interaction.isModalSubmit()) {
        const customId = interaction.customId;
        const guild = await resolveGuild(interaction);
        const member = interaction.member as GuildMember;
        if (member && !member.guild && guild) {
          (member as any).guild = guild;
        }

        if (customId === 'academy_report_modal') {
          await interaction.deferReply({ ephemeral: true });
          const mpType = interaction.fields.getTextInputValue('report_mp_type');
          const rawScreenshots = interaction.fields.getTextInputValue('report_screenshots');
          const comment = interaction.fields.getTextInputValue('report_comment') || undefined;

          // Split screenshots by whitespace or newline
          const screenshotUrls = rawScreenshots
            .split(/[\s\n]+/)
            .filter((s) => s.startsWith('http://') || s.startsWith('https://'));

          if (screenshotUrls.length === 0) {
            await interaction.editReply({ content: '❌ Укажите хотя бы одну действительную ссылку на скриншот (http/https).' });
            return;
          }

          try {
            await AcademyService.submitReport(
              interaction.guildId!,
              member,
              interaction.channelId!,
              mpType,
              screenshotUrls,
              comment
            );
            await interaction.editReply({ content: '✅ Ваш отчет по МП успешно отправлен на проверку рекрутерам!' });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка отправки отчета: ${err.message}` });
          }
          return;
        }

        if (customId.startsWith('academy_reject_modal_') || customId.startsWith('academy_report_reject_modal_')) {
          const reportId = customId.startsWith('academy_report_reject_modal_')
            ? customId.replace('academy_report_reject_modal_', '')
            : customId.replace('academy_reject_modal_', '');
          const reason = interaction.fields.getTextInputValue('reject_reason');
          await interaction.deferReply();
          try {
            await AcademyService.reviewReport(reportId, member, false, reason);
            await interaction.editReply({ content: `❌ Отчет #${reportId} отклонен рекрутером ${member}.` });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка: ${err.message}` });
          }
          return;
        }

        if (customId.startsWith('academy_promo_reject_modal_') || customId.startsWith('academy_promote_reject_modal_')) {
          const academyChannelId = customId.startsWith('academy_promote_reject_modal_')
            ? customId.replace('academy_promote_reject_modal_', '')
            : customId.replace('academy_promo_reject_modal_', '');
          const reason = interaction.fields.getTextInputValue('promo_reject_reason');
          const penalty = parseInt(interaction.fields.getTextInputValue('promo_penalty_count'), 10) || 2;
          await interaction.deferReply();
          try {
            await AcademyService.promoteAcademician(academyChannelId, member, false, reason, penalty);
            await interaction.editReply({ content: `⚠️ Повышение отклонено. Академику назначен штраф в ${penalty} МП.` });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка: ${err.message}` });
          }
          return;
        }

        if (customId === 'recruit_modal_submit') {
          await RecruitmentService.handleModalSubmit(interaction);
          return;
        }

        if (customId.startsWith('recruit_modal_reject_')) {
          const applicationId = customId.replace('recruit_modal_reject_', '');
          await RecruitmentService.handleRejectSubmit(interaction, applicationId);
          return;
        }

        // --- Panel Modals ---
        if (customId === 'modal_bind_static') {
          await interaction.deferReply({ ephemeral: true });
          const staticId = interaction.fields.getTextInputValue('static_id');
          const characterName = interaction.fields.getTextInputValue('character_name') || undefined;
          const targetGuildId = interaction.guildId || (guild ? guild.id : '');

          try {
            if (!targetGuildId) throw new Error('Сервер Discord не определен.');
            await ProfileService.setStatic(
              targetGuildId,
              interaction.user.id,
              staticId,
              characterName,
              interaction.user.tag
            );
            if (interaction.member && (interaction.member as GuildMember).manageable) {
              await NicknameService.syncMemberNickname(interaction.member as GuildMember, 'Привязка статика и ника через панель').catch(() => null);
            }
            await interaction.editReply({
              content: `✅ Ваш Static ID **${staticId}**${characterName ? ` (${characterName})` : ''} успешно привязан!`
            });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка привязки статика: ${err.message}` });
          }
          return;
        }

        if (customId === 'modal_request_leave') {
          await interaction.deferReply({ ephemeral: true });
          const rawStart = interaction.fields.getTextInputValue('leave_start_date');
          const rawEnd = interaction.fields.getTextInputValue('leave_end_date');
          const reason = interaction.fields.getTextInputValue('leave_reason');

          const parseDate = (str: string): Date => {
            const parts = str.trim().split(/[./-]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
              } else {
                let y = parseInt(parts[2], 10);
                if (y < 100) y += 2000;
                return new Date(y, parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
              }
            }
            return new Date(str);
          };

          const startDate = parseDate(rawStart);
          const endDate = parseDate(rawEnd);

          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            await interaction.editReply({ content: '❌ Неверный формат дат. Используйте формат: ДД.ММ.ГГГГ' });
            return;
          }

          const targetGuildId = interaction.guildId || (guild ? guild.id : '');
          if (!targetGuildId) {
            await interaction.editReply({ content: '❌ Сервер Discord не определен.' });
            return;
          }

          try {
            const leave = await LeaveService.requestLeave(
              targetGuildId,
              interaction.user.id,
              interaction.user.tag,
              startDate,
              endDate,
              reason,
              'VACATION'
            );

            if (guild) {
              const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId: targetGuildId } });
              if (guildConfig?.leaveRequestChannelId) {
                const leaveChannel = (guild.channels.cache.get(guildConfig.leaveRequestChannelId) ||
                  await guild.channels.fetch(guildConfig.leaveRequestChannelId).catch(() => null)) as TextChannel | null;
                if (leaveChannel && leaveChannel.isTextBased()) {
                  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                  const leaveEmbed = createThemedEmbed({
                    title: 'ЗАЯВКА НА ОТПУСК',
                    color: THEME.COLORS.WARNING,
                    description: [
                      THEME.format.quote('Новая заявка на временное освобождение от обязанностей.'),
                      '',
                      THEME.format.item('Участник', `${member || interaction.user} (\`${interaction.user.tag}\`)`),
                      THEME.format.item('Тип', 'Отпуск'),
                      THEME.format.item('Период', `с ${THEME.format.bold(startDate.toLocaleDateString('ru-RU'))} по ${THEME.format.bold(endDate.toLocaleDateString('ru-RU'))} (\`${days} дн.\`)`),
                      THEME.format.item('Причина', reason),
                      THEME.format.item('ID заявки', THEME.format.code(leave.id)),
                    ].join('\n'),
                    footerText: 'INTERPOL • Управление отпусками',
                  });

                  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setCustomId(`leave_approve_${leave.id}`)
                      .setLabel('Одобрить')
                      .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                      .setCustomId(`leave_reject_${leave.id}`)
                      .setLabel('Отклонить')
                      .setStyle(ButtonStyle.Danger)
                  );

                  await leaveChannel.send({ embeds: [leaveEmbed], components: [actionRow] }).catch(() => null);
                }
              }
            }

            await interaction.editReply({
              content: `✅ Заявка на отпуск с **${startDate.toLocaleDateString('ru-RU')}** по **${endDate.toLocaleDateString('ru-RU')}** успешно отправлена руководству на рассмотрение!`
            });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка: ${err.message}` });
          }
          return;
        }

        if (customId === 'modal_request_timeoff') {
          await interaction.deferReply({ ephemeral: true });
          const rawDuration = interaction.fields.getTextInputValue('timeoff_duration').trim().toLowerCase();
          const reason = interaction.fields.getTextInputValue('timeoff_reason');

          let durationMinutes = 0;
          const hoursMatch = rawDuration.match(/(\d+)\s*(ч|час|часа|часов|h|hour|hours)/);
          const minsMatch = rawDuration.match(/(\d+)\s*(м|мин|минут|минуты|m|min|mins)/);

          if (hoursMatch) {
            durationMinutes += parseInt(hoursMatch[1], 10) * 60;
          }
          if (minsMatch) {
            durationMinutes += parseInt(minsMatch[1], 10);
          }
          if (!hoursMatch && !minsMatch) {
            const num = parseInt(rawDuration, 10);
            if (!isNaN(num)) {
              durationMinutes = num <= 24 ? num * 60 : num;
            }
          }

          if (durationMinutes < 5 || durationMinutes > 1440) {
            await interaction.editReply({
              content: '❌ Некорректная длительность отгула. Отгул может составлять от 5 минут до 24 часов (например: `2 часа` или `45м`).'
            });
            return;
          }

          const startDate = new Date();
          const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

          const targetGuildId = interaction.guildId || (guild ? guild.id : '');
          if (!targetGuildId) {
            await interaction.editReply({ content: '❌ Сервер Discord не определен.' });
            return;
          }

          try {
            const leave = await LeaveService.requestLeave(
              targetGuildId,
              interaction.user.id,
              interaction.user.tag,
              startDate,
              endDate,
              reason,
              'TIMEOFF'
            );

            if (guild) {
              const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId: targetGuildId } });
              if (guildConfig?.leaveRequestChannelId) {
                const leaveChannel = (guild.channels.cache.get(guildConfig.leaveRequestChannelId) ||
                  await guild.channels.fetch(guildConfig.leaveRequestChannelId).catch(() => null)) as TextChannel | null;
                if (leaveChannel && leaveChannel.isTextBased()) {
                  const hours = Math.floor(durationMinutes / 60);
                  const remM = durationMinutes % 60;
                  const durText = hours > 0 ? `${hours} ч. ${remM > 0 ? `${remM} мин.` : ''}` : `${remM} мин.`;

                  const leaveEmbed = createThemedEmbed({
                    title: 'ЗАЯВКА НА ОТГУЛ',
                    color: THEME.COLORS.WARNING,
                    description: [
                      THEME.format.quote('Новая заявка на кратковременный отгул.'),
                      '',
                      THEME.format.item('Участник', `${member || interaction.user} (\`${interaction.user.tag}\`)`),
                      THEME.format.item('Тип', 'Кратковременный отгул'),
                      THEME.format.item('Длительность', `${THEME.format.bold(durText)} (до ${endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})`),
                      THEME.format.item('Причина', reason),
                      THEME.format.item('ID заявки', THEME.format.code(leave.id)),
                    ].join('\n'),
                    footerText: 'INTERPOL • Управление отпусками',
                  });

                  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setCustomId(`leave_approve_${leave.id}`)
                      .setLabel('Одобрить')
                      .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                      .setCustomId(`leave_reject_${leave.id}`)
                      .setLabel('Отклонить')
                      .setStyle(ButtonStyle.Danger)
                  );

                  await leaveChannel.send({ embeds: [leaveEmbed], components: [actionRow] }).catch(() => null);
                }
              }
            }

            await interaction.editReply({
              content: `✅ Заявка на отгул на **${rawDuration}** успешно отправлена руководству на рассмотрение!`
            });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка: ${err.message}` });
          }
          return;
        }

        // --- Tier System Modals ---
        if (customId.startsWith('tier_clip_modal_')) {
          const raw = customId.replace('tier_clip_modal_', '');
          const lastUnderscore = raw.lastIndexOf('_');
          const mpType = decodeURIComponent(raw.substring(0, lastUnderscore));
          const ticketId = raw.substring(lastUnderscore + 1);
          await TierService.handleClipModalSubmit(interaction, mpType, ticketId);
          return;
        }

        if (customId.startsWith('tier_review_modal_')) {
          const submissionId = customId.replace('tier_review_modal_', '');
          await TierService.handleReviewModalSubmit(interaction, submissionId);
          return;
        }
      }

      // 4. Select Menus
      if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;
        const guild = await resolveGuild(interaction);
        const member = interaction.member as GuildMember;
        if (member && !member.guild && guild) {
          (member as any).guild = guild;
        }

        if (customId.startsWith('event_admin_kick_')) {
          await EventService.handleAdminKick(interaction);
          return;
        }
      }
    } catch (error: any) {
      console.error('[InteractionHandler Error]:', error);
      if (interaction.isRepliable()) {
        const errorText = '❌ Произошла непредвиденная ошибка при выполнении действия. Проверьте права бота или повторите попытку позже.';
        const replyOptions = { content: errorText, ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(replyOptions).catch(async () => {
            await interaction.followUp(replyOptions).catch(() => null);
          });
        } else {
          await interaction.reply(replyOptions).catch(() => null);
        }
      }
    }
  });
}
