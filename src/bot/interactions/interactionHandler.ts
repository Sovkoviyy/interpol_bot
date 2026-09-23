import { 
  Interaction, 
  Events, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  GuildMember, 
  EmbedBuilder 
} from 'discord.js';
import bot from '../client';
import { RecruitmentService } from '../modules/recruitment/recruitmentService';
import { EventService } from '../modules/events/eventService';
import { AcademyService } from '../modules/academy/academyService';
import { VoiceTrackerService } from '../modules/voiceTracker/voiceTrackerService';
import { ProfileService } from '../modules/profiles/profileService';
import { LeaveService } from '../modules/leave/leaveService';
import prisma from '../../database/client';

export function registerInteractionHandler() {
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
        const member = interaction.member as GuildMember;

        // --- Academy Buttons ---
        if (customId === 'academy_submit_report_btn') {
          const modal = new ModalBuilder()
            .setCustomId('academy_report_modal')
            .setTitle('Сдача отчета по МП');

          const mpTypeInput = new TextInputBuilder()
            .setCustomId('report_mp_type')
            .setLabel('Тип мероприятия')
            .setPlaceholder('например: Дроп, Цех, ВЗМ, МЦЛ, Капт')
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

          const progressEmbed = new EmbedBuilder()
            .setColor(0xEC4899)
            .setTitle('📊 Ваш текущий прогресс в академии')
            .setDescription(
              `• **Одобрено МП:** \`${academy.approvedMpCount} / ${neededTotal}\`\n` +
              `• **Штрафные МП:** \`${academy.penaltyMp}\`\n` +
              `• **Осталось сыграть:** \`${remaining}\` МП\n\n` +
              (remaining === 0
                ? '🎉 **Вы выполнили норму!** Ожидайте подтверждения от рекрутера.'
                : 'Продолжайте посещать сборы семьи и сдавать отчеты!')
            )
            .setTimestamp();

          await interaction.reply({ embeds: [progressEmbed], ephemeral: true });
          return;
        }

        if (customId.startsWith('academy_approve_report_')) {
          const reportId = customId.replace('academy_approve_report_', '');
          await interaction.deferReply();
          try {
            await AcademyService.reviewReport(reportId, member, true);
            await interaction.editReply({ content: `✅ Отчет #${reportId} успешно одобрен рекрутером ${member}.` });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка: ${err.message}` });
          }
          return;
        }

        if (customId.startsWith('academy_reject_report_')) {
          const reportId = customId.replace('academy_reject_report_', '');
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

        if (customId.startsWith('academy_promote_confirm_')) {
          const academyChannelId = customId.replace('academy_promote_confirm_', '');
          await interaction.deferReply();
          try {
            await AcademyService.promoteAcademician(academyChannelId, member, true);
            await interaction.editReply({ content: `🎖️ Академик успешно повышен на 2 ранг рекрутером ${member}!` });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка: ${err.message}` });
          }
          return;
        }

        if (customId.startsWith('academy_promote_reject_')) {
          const academyChannelId = customId.replace('academy_promote_reject_', '');
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

        // --- Voice Tracker Buttons ---
        if (customId === 'voice_tracker_end_btn') {
          await interaction.deferReply({ ephemeral: true });
          try {
            await VoiceTrackerService.endSession(interaction.guild!, member);
            await interaction.editReply({ content: '🏁 Текущее мероприятие успешно завершено. Статистика отправлена в лог.' });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ ${err.message}` });
          }
          return;
        }

        if (customId === 'voice_tracker_status_btn') {
          const config = await VoiceTrackerService.getConfig(interaction.guildId!);
          const voiceChannel = config.voiceChannelId
            ? interaction.guild!.channels.cache.get(config.voiceChannelId)
            : null;

          const session = await prisma.voiceTrackerSession.findFirst({
            where: { guildId: interaction.guildId!, status: 'ACTIVE' },
          });

          if (!session) {
            await interaction.reply({
              content: 'ℹ️ В данный момент нет активного мероприятия в голосовом канале.',
              ephemeral: true,
            });
            return;
          }

          const membersCount = voiceChannel && 'members' in voiceChannel ? (voiceChannel as any).members.size : 0;
          await interaction.reply({
            content: `🔊 **Активное МП:** «${session.eventName}»\n👥 **Сейчас в войсе:** \`${membersCount}\` чел.`,
            ephemeral: true,
          });
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

        if (customId.startsWith('recruit_reject_')) {
          const applicationId = customId.replace('recruit_reject_', '');
          await RecruitmentService.promptRejectModal(interaction, applicationId);
          return;
        }

        // --- Event Buttons ---
        if (customId.startsWith('event_join_')) {
          const eventId = customId.replace('event_join_', '');
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

        if (customId === 'panel_request_leave') {
          const modal = new ModalBuilder()
            .setCustomId('modal_request_leave')
            .setTitle('Заявка на отпуск / АФК (макс 14 дн)');

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
      }

      // 3. Modals
      if (interaction.isModalSubmit()) {
        const customId = interaction.customId;
        const member = interaction.member as GuildMember;

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

        if (customId.startsWith('academy_reject_modal_')) {
          const reportId = customId.replace('academy_reject_modal_', '');
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

        if (customId.startsWith('academy_promo_reject_modal_')) {
          const academyChannelId = customId.replace('academy_promo_reject_modal_', '');
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

          try {
            await ProfileService.setStatic(
              interaction.guildId!,
              interaction.user.id,
              staticId,
              characterName,
              interaction.user.tag
            );
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
                return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
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

          try {
            await LeaveService.requestLeave(
              interaction.guildId!,
              interaction.user.id,
              interaction.user.tag,
              startDate,
              endDate,
              reason
            );
            await interaction.editReply({
              content: `✅ Заявка на отпуск с **${startDate.toLocaleDateString('ru-RU')}** по **${endDate.toLocaleDateString('ru-RU')}** успешно отправлена руководству на рассмотрение!`
            });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ Ошибка: ${err.message}` });
          }
          return;
        }
      }

      // 4. Select Menus
      if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;
        const member = interaction.member as GuildMember;

        if (customId === 'voice_tracker_select_mp') {
          const selectedMp = interaction.values[0];
          await interaction.deferReply({ ephemeral: true });
          try {
            await VoiceTrackerService.startSession(interaction.guild!, selectedMp, member);
            await interaction.editReply({
              content: `⚔️ Мероприятие **«${selectedMp}»** успешно запущено! Войс-канал переименован, учет явки начался.`,
            });
          } catch (err: any) {
            await interaction.editReply({ content: `❌ ${err.message}` });
          }
          return;
        }

        if (customId.startsWith('event_admin_kick_')) {
          await EventService.handleAdminKick(interaction);
          return;
        }
      }
    } catch (error) {
      console.error('[InteractionHandler Error]:', error);
      if (interaction.isRepliable()) {
        const replyOptions = { content: '❌ Произошла ошибка при выполнении действия.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(replyOptions).catch(() => null);
        } else {
          await interaction.reply(replyOptions).catch(() => null);
        }
      }
    }
  });
}
