import {
  Guild,
  GuildMember,
  TextChannel,
  VoiceChannel,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import prisma from '../../../database/client';
import { FormQuestion } from '../../../shared/types';
import { TranscriptService } from './transcript';
import { AuditLogger } from '../logging/auditLogger';
import { AcademyService } from '../academy/academyService';
import { ProfileService } from '../profiles/profileService';
import { buildCustomTemplateEmbed } from '../../utils/templateEmbed';
import { NicknameService } from '../nicknames/nicknameService';
import { extractFirstName, sanitizeChannelNamePart } from '../../utils/nameUtils';
import bot from '../../client';
import { THEME, createThemedEmbed } from '../../utils/theme';
import { BotMessageManager } from '../../utils/botMessageManager';

export class RecruitmentService {
  private static async resolveGuild(interaction: { guild?: Guild | null; guildId?: string | null }): Promise<Guild | null> {
    if (interaction.guild) return interaction.guild;
    const guildId = interaction.guildId;
    if (!guildId) return null;
    return bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
  }

  /**
   * Helper to send recruitment audit logs to the designated recruitment review/log channel (#заявки-набор)
   */
  public static async sendRecruitmentLog(
    guild: Guild,
    embed: EmbedBuilder,
    files: any[] = []
  ): Promise<void> {
    try {
      if (!guild) return;
      const config = await prisma.recruitmentConfig.findUnique({
        where: { guildId: guild.id },
      }).catch(() => null);

      let logChannel: TextChannel | null = null;
      if (config?.logChannelId) {
        logChannel = (guild.channels.cache.get(config.logChannelId) ||
          await guild.channels.fetch(config.logChannelId).catch(() => null)) as TextChannel | null;
      }

      // Fallback by channel name if not configured or if logChannelId points to wrong type/deleted
      if (!logChannel || !logChannel.isTextBased()) {
        logChannel = (guild.channels.cache.find(
          c => c.type === ChannelType.GuildText && (c.name.toLowerCase() === 'заявки-лог' || c.name.toLowerCase() === 'заявки-набор' || c.name.toLowerCase() === 'лог-заявок')
        ) || null) as TextChannel | null;

        if (logChannel && config && config.logChannelId !== logChannel.id) {
          await prisma.recruitmentConfig.update({
            where: { guildId: guild.id },
            data: { logChannelId: logChannel.id },
          }).catch(() => null);
        }
      }

      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({ embeds: [embed], files }).catch(e => {
          console.error('[Recruitment] Error sending log to recruitReviewChannel:', e);
        });
      }
    } catch (err) {
      console.error('[Recruitment] sendRecruitmentLog error:', err);
    }
  }

  /**
   * Get default form questions if none configured in DB
   */
  public static getDefaultQuestions(): FormQuestion[] {
    return [
      {
        id: 'q_name',
        label: 'Имя Фамилия (RP Nickname)',
        placeholder: 'John Doe',
        required: true,
        style: 'SHORT',
        maxLength: 50,
      },
      {
        id: 'q_static',
        label: 'Статический ID / Паспорт',
        placeholder: '123456',
        required: true,
        style: 'SHORT',
        maxLength: 20,
      },
      {
        id: 'q_age',
        label: 'Реальный возраст',
        placeholder: '18',
        required: true,
        style: 'SHORT',
        maxLength: 5,
      },
      {
        id: 'q_experience',
        label: 'Опыт в семьях / фракциях',
        placeholder: 'Был в семьях ..., капты, стрельба 8/10',
        required: true,
        style: 'PARAGRAPH',
        maxLength: 500,
      },
      {
        id: 'q_online',
        label: 'Средний суточный онлайн (часов)',
        placeholder: '4-6 часов',
        required: true,
        style: 'SHORT',
        maxLength: 30,
      },
    ];
  }

  /**
   * Builds the interactive application modal for a user
   */
  public static async buildApplicationModal(guildId: string): Promise<ModalBuilder> {
    const config = await prisma.recruitmentConfig.findUnique({
      where: { guildId },
    });

    let questions: FormQuestion[] = [];
    if (config?.questionsJson) {
      try {
        questions = JSON.parse(config.questionsJson);
      } catch {
        questions = this.getDefaultQuestions();
      }
    }
    if (!questions || questions.length === 0) {
      questions = this.getDefaultQuestions();
    }

    // Limit to 5 fields (Discord max)
    questions = questions.slice(0, 5);

    const modal = new ModalBuilder()
      .setCustomId('recruit_modal_submit')
      .setTitle('Заявка на вступление в семью');

    for (const q of questions) {
      const input = new TextInputBuilder()
        .setCustomId(q.id)
        .setLabel(q.label.slice(0, 45))
        .setStyle(q.style === 'PARAGRAPH' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(q.required);

      if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100));
      if (q.maxLength) input.setMaxLength(q.maxLength);

      const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
      modal.addComponents(row);
    }

    return modal;
  }

  /**
   * Handles user submission of the modal
   */
  public static async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const guild = await this.resolveGuild(interaction);
      if (!guild) {
        const errorContent = '❌ Сервер Discord не определен.';
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: errorContent }).catch(() => null);
        } else {
          await interaction.reply({ content: errorContent, ephemeral: true }).catch(() => null);
        }
        return;
      }

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => null);
      }

      // Check if recruitment is enabled
      const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } }).catch(() => null);
      if (guildConfig && !guildConfig.recruitmentEnabled) {
        await interaction.editReply({ content: '❌ Прием заявок в семью в данный момент закрыт.' }).catch(() => null);
        return;
      }

      const recConfig = await prisma.recruitmentConfig.findUnique({ where: { guildId: guild.id } }).catch(() => null);
      if (!recConfig) {
        await interaction.editReply({ content: '❌ Модуль заявок еще не настроен администратором.' }).catch(() => null);
        return;
      }

      // Check if user already has an active application
      const existing = await prisma.recruitmentApplication.findFirst({
        where: {
          guildId: guild.id,
          userId: interaction.user.id,
          status: { in: ['PENDING', 'UNDER_REVIEW'] },
        },
      }).catch(() => null);

      if (existing && existing.channelId) {
        await interaction.editReply({
          content: `❌ У вас уже есть открытая заявка в канале <#${existing.channelId}>!`,
        }).catch(() => null);
        return;
      }

      // Parse answers
      const answers: Record<string, string> = {};
      let questions: FormQuestion[] = [];
      try {
        questions = JSON.parse(recConfig.questionsJson || '[]');
      } catch {
        questions = this.getDefaultQuestions();
      }
      if (questions.length === 0) questions = this.getDefaultQuestions();

      for (const q of questions.slice(0, 5)) {
        try {
          const val = interaction.fields.getTextInputValue(q.id);
          answers[q.label] = val;
        } catch {
          // Field wasn't in modal
        }
      }

      // Recruiter role IDs
      let recruiterRoleIds: string[] = [];
      try {
        recruiterRoleIds = JSON.parse(recConfig.recruiterRoleIds || '[]');
      } catch {
        recruiterRoleIds = [];
      }

      // Parse candidate character name and static ID from answers
      let candidateStaticId = '';
      let candidateCharName = '';
      for (const [key, val] of Object.entries(answers)) {
        const k = key.toLowerCase();
        if (!candidateCharName && (k.includes('имя') || k.includes('ник') || k.includes('name') || k.includes('rp'))) {
          candidateCharName = val.trim();
        }
        if (!candidateStaticId && (k.includes('статик') || k.includes('static') || k.includes('паспорт') || k.includes('id'))) {
          candidateStaticId = val.replace(/[^\d]/g, '').trim() || val.trim();
        }
      }

      // Extract FIRST NAME strictly (without surname)
      const firstName = extractFirstName(candidateCharName || interaction.user.username);

      // Automatically bind provided data directly into UserProfile
      try {
        if (candidateStaticId) {
          await ProfileService.setStatic(
            guild.id,
            interaction.user.id,
            candidateStaticId,
            firstName,
            interaction.user.tag,
            true
          );
        } else {
          await ProfileService.getOrCreateProfile(guild.id, interaction.user.id, interaction.user.tag);
        }
      } catch (bindErr: any) {
        console.warn('[Recruitment] Could not auto-bind static on modal submit:', bindErr.message);
      }

      // Update Discord nickname to FIRST NAME strictly (without surname)
      const member = (interaction.member as GuildMember) || await guild.members.fetch(interaction.user.id).catch(() => null);
      if (typeof (member as any)?.setNickname === 'function' && member?.manageable && firstName) {
        await member.setNickname(firstName, 'Подача заявки в семью (Имя без фамилии)').catch(err => {
          console.warn(`[Recruitment] Could not set nickname for ${interaction.user.tag}:`, err.message);
        });
      }

      // Channel name: format strictly like имя-статик (e.g. tony-142055)
      const cleanFirstName = sanitizeChannelNamePart(firstName, 'кандидат');
      const cleanStatic = candidateStaticId ? candidateStaticId.replace(/[^\d]/g, '').slice(0, 10) : interaction.user.id.slice(-4);
      const channelName = `${cleanFirstName}-${cleanStatic}`;

      // Resolve bot user ID safely
      const botUserId = guild.members.me?.id || bot.user?.id;

      // Create private ticket channel with strictly valid snowflakes
      const overwrites: any[] = [];

      // @everyone deny
      if (guild.roles.everyone?.id) {
        overwrites.push({
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        });
      }

      // Candidate allow
      if (interaction.user.id) {
        overwrites.push({
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }

      // Bot allow
      if (botUserId) {
        overwrites.push({
          id: botUserId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
          ],
        });
      }

      // Recruiter roles
      for (const roleId of recruiterRoleIds) {
        if (typeof roleId === 'string' && /^\d{17,20}$/.test(roleId) && guild.roles.cache.has(roleId)) {
          overwrites.push({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          });
        }
      }

      // Validate parent category: must exist, be GuildCategory, and have < 50 channels
      let parentCategoryId: string | undefined = undefined;
      if (recConfig.categoryId && typeof recConfig.categoryId === 'string' && /^\d{17,20}$/.test(recConfig.categoryId)) {
        const cat = guild.channels.cache.get(recConfig.categoryId) || await guild.channels.fetch(recConfig.categoryId).catch(() => null);
        if (cat && cat.type === ChannelType.GuildCategory) {
          const childCount = guild.channels.cache.filter(c => c.parentId === cat.id).size;
          if (childCount < 50) {
            parentCategoryId = cat.id;
          }
        }
      }

      // If no valid category configured or it is full, find or auto-create dedicated "📨 ЗАЯВКИ" category
      if (!parentCategoryId) {
        let cat = guild.channels.cache.find(
          c => c.type === ChannelType.GuildCategory && (c.name.includes('ЗАЯВКИ') || c.name.toUpperCase().includes('TICKETS'))
        );
        if (!cat) {
          const catOverwrites: any[] = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          ];
          if (botUserId) {
            catOverwrites.push({
              id: botUserId,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages],
            });
          }
          cat = (await guild.channels.create({
            name: '📨 ЗАЯВКИ В СЕМЬЮ',
            type: ChannelType.GuildCategory,
            permissionOverwrites: catOverwrites,
          }).catch(() => undefined)) as any;

          if (cat) {
            await prisma.recruitmentConfig.update({
              where: { guildId: guild.id },
              data: { categoryId: cat.id },
            }).catch(() => null);
          }
        }
        if (cat && cat.type === ChannelType.GuildCategory) {
          parentCategoryId = cat.id;
        }
      }

      // Resilient channel creation with automatic fallback on Discord API 50035 / permissions errors
      let ticketChannel: TextChannel;
      try {
        ticketChannel = (await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: parentCategoryId,
          permissionOverwrites: overwrites,
        })) as TextChannel;
      } catch (createErr: any) {
        console.warn(`[Recruitment] Initial channel creation failed (${createErr.message}). Retrying with safe minimal fallback...`);
        
        const fallbackOverwrites: any[] = [];
        if (guild.roles.everyone?.id) {
          fallbackOverwrites.push({
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          });
        }
        fallbackOverwrites.push({
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
        if (botUserId) {
          fallbackOverwrites.push({
            id: botUserId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
          });
        }

        ticketChannel = (await guild.channels.create({
          name: `заявка-${interaction.user.id.slice(-4)}`,
          type: ChannelType.GuildText,
          permissionOverwrites: fallbackOverwrites,
        })) as TextChannel;
      }

      // Save DB application
      const application = await prisma.recruitmentApplication.create({
        data: {
          guildId: guild.id,
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          channelId: ticketChannel.id,
          status: 'PENDING',
          answersJson: JSON.stringify(answers),
        },
      });

      // Create ticket embed
      const nowUnix = Math.floor(Date.now() / 1000);
      const descLines = [
        THEME.format.quote('Новая анкета кандидата на вступление в семью.'),
        '',
        THEME.format.item('Кандидат', `${interaction.user} (\`${interaction.user.tag}\`)`),
        THEME.format.item('Дата подачи', `<t:${nowUnix}:F> (<t:${nowUnix}:R>)`),
        THEME.format.item('Статус', 'Ожидает рассмотрения'),
        '',
        THEME.format.subtext('Рекрутеры семьи могут принять решение с помощью кнопок ниже'),
      ];

      const ticketFields = Object.entries(answers).map(([question, answer]) => ({
        name: question,
        value: answer || 'Не указано',
        inline: false,
      }));

      const embed = createThemedEmbed({
        title: `ЗАЯВКА В СЕМЬЮ • ${interaction.user.username.toUpperCase()}`,
        description: descLines.join('\n'),
        color: THEME.COLORS.PRIMARY,
        thumbnailUrl: interaction.user.displayAvatarURL({ size: 256 }),
        fields: ticketFields,
        footerText: 'INTERPOL • Набор в семью',
      });

      const buttonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`recruit_claim_${application.id}`)
          .setLabel('Взять на рассмотрение')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`recruit_approve_${application.id}`)
          .setLabel('Одобрить')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`recruit_interview_${application.id}`)
          .setLabel('Обзвон')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`recruit_reject_${application.id}`)
          .setLabel('Отклонить')
          .setStyle(ButtonStyle.Danger)
      );

      // Mention recruiter roles if configured
      const recruiterPings = recruiterRoleIds.filter(r => guild.roles.cache.has(r)).map(r => `<@&${r}>`).join(' ');
      await ticketChannel.send({
        content: `${interaction.user} ${recruiterPings}`.trim(),
        embeds: [embed],
        components: [buttonsRow],
      }).catch(err => console.error('[Recruitment] Error sending initial ticket message:', err));

      // Send custom candidate greeting/instructions from BotMessagesConfig if present
      try {
        const botMsgConfig = await prisma.botMessagesConfig.findUnique({ where: { guildId: guild.id } }).catch(() => null);
        if (botMsgConfig) {
          let customTemplate: any = null;
          if (botMsgConfig.ticketTemplateId) {
            customTemplate = await prisma.customEmbedTemplate.findUnique({
              where: { id: botMsgConfig.ticketTemplateId },
            }).catch(() => null);
          }

          if (customTemplate) {
            const embed = buildCustomTemplateEmbed(customTemplate, {
              user: `<@${interaction.user.id}>`,
              username: interaction.user.username,
              guild: guild.name,
              memberCount: String(guild.memberCount),
            });
            await ticketChannel.send({ embeds: [embed] }).catch(() => null);
          } else {
            const rendered = await BotMessageManager.renderMessage(guild.id, 'ticket_welcome', {
              user: `<@${interaction.user.id}>`,
              username: interaction.user.username,
              guild: guild.name,
              recruiterRole: recruiterPings,
              staticId: candidateStaticId,
            });
            if (rendered.enabled) {
              await ticketChannel.send({
                content: rendered.content,
                embeds: [rendered.embed],
              }).catch(() => null);
            }
          }
        }
      } catch (err) {
        console.error('[Recruitment] Error sending ticket greeting:', err);
      }

      await interaction.editReply({
        content: `Ваша заявка успешно создана. Перейдите в канал: <#${ticketChannel.id}>`,
      }).catch(() => null);

      // Send DM to candidate
      BotMessageManager.sendDM(guild.id, interaction.user.id, 'recruitment_dm_submitted', {
        user: `<@${interaction.user.id}>`,
        username: interaction.user.username,
        guild: guild.name,
        staticId: candidateStaticId || 'Не указан',
      }).catch(() => null);

      // Log to Recruitment Channel (#заявки-набор)
      const recruitLogEmbed = createThemedEmbed({
        title: `НОВАЯ ЗАЯВКА В СЕМЬЮ • ${interaction.user.tag.toUpperCase()}`,
        color: THEME.COLORS.PRIMARY,
        description: [
          THEME.format.item('Кандидат', `${interaction.user} (\`${interaction.user.tag}\`)`),
          THEME.format.item('Канал заявки', `<#${ticketChannel.id}>`),
          THEME.format.item('Время подачи', `<t:${nowUnix}:F> (<t:${nowUnix}:R>)`),
        ].join('\n'),
        fields: ticketFields,
        thumbnailUrl: interaction.user.displayAvatarURL(),
        footerText: 'INTERPOL • Журнал заявок',
      });

      await this.sendRecruitmentLog(guild, recruitLogEmbed);

      // Log to BOT logs
      const logEmbed = createThemedEmbed({
        title: 'СОЗДАНА НОВАЯ ЗАЯВКА',
        color: THEME.COLORS.PRIMARY,
        description: [
          THEME.format.item('Кандидат', `${interaction.user} (\`${interaction.user.tag}\`)`),
          THEME.format.item('Канал', `<#${ticketChannel.id}>`),
          THEME.format.item('Время', `<t:${nowUnix}:F>`),
        ].join('\n'),
        footerText: 'INTERPOL • Бот-лог',
      });
      await AuditLogger.sendLog(guild, 'BOT', logEmbed).catch(() => null);
    } catch (err: any) {
      console.error('[Recruitment handleModalSubmit Error]:', err);
      const userErrorMsg = `❌ Не удалось создать заявку (${err.message || 'Ошибка прав Discord'}). Убедитесь, что у бота есть право «Управлять каналами» (Manage Channels).`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: userErrorMsg }).catch(() => null);
      } else {
        await interaction.reply({ content: userErrorMsg, ephemeral: true }).catch(() => null);
      }
    }
  }

  /**
   * Check if member is a recruiter or admin
   */
  public static async isRecruiter(member: GuildMember): Promise<boolean> {
    if (!member) return false;
    const hasAdmin = member.permissions && typeof member.permissions.has === 'function'
      ? member.permissions.has(PermissionFlagsBits.Administrator)
      : false;
    if (hasAdmin) return true;

    const guildId = member.guild?.id;
    if (!guildId) return false;

    const config = await prisma.recruitmentConfig.findUnique({
      where: { guildId },
    });
    if (!config) return false;

    let roles: string[] = [];
    try {
      roles = JSON.parse(config.recruiterRoleIds || '[]');
    } catch {
      roles = [];
    }

    if (member.roles && 'cache' in member.roles && member.roles.cache) {
      return roles.some(r => member.roles.cache.has(r));
    } else if (Array.isArray(member.roles)) {
      return roles.some(r => (member.roles as any).includes(r));
    }
    return false;
  }

  /**
   * Claim ticket handler
   */
  public static async handleClaim(interaction: ButtonInteraction, applicationId: string): Promise<void> {
    const member = interaction.member as GuildMember;
    if (!(await this.isRecruiter(member))) {
      await interaction.reply({ content: '❌ У вас нет прав рекрутера для этого действия.', ephemeral: true });
      return;
    }

    const application = await prisma.recruitmentApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      await interaction.reply({ content: '❌ Заявка не найдена в базе данных.', ephemeral: true });
      return;
    }

    await prisma.recruitmentApplication.update({
      where: { id: applicationId },
      data: {
        status: 'UNDER_REVIEW',
        recruiterId: interaction.user.id,
        recruiterTag: interaction.user.tag,
      },
    });

    await interaction.reply({
      content: `📌 Рекрутер ${interaction.user} взял заявку на рассмотрение.`,
    });

    const guild = await this.resolveGuild(interaction);
    if (guild) {
      const candidateTag = application.userTag || 'Кандидат';
      const claimEmbed = createThemedEmbed({
        title: `ЗАЯВКА В РАБОТЕ • ${candidateTag.toUpperCase()}`,
        color: THEME.COLORS.WARNING,
        description: [
          THEME.format.quote('Заявка принята на рассмотрение рекрутером.'),
          '',
          THEME.format.item('Кандидат', `<@${application.userId}> (\`${application.userTag}\`)`),
          THEME.format.item('Рекрутер', `${interaction.user} (\`${interaction.user.tag}\`)`),
          application.channelId ? THEME.format.item('Канал заявки', `<#${application.channelId}>`) : null,
          THEME.format.item('Время', `<t:${Math.floor(Date.now() / 1000)}:F>`),
        ].filter(Boolean).join('\n'),
        footerText: 'INTERPOL • Набор в семью',
      });
      await this.sendRecruitmentLog(guild, claimEmbed);
    }

    // Update original embed if possible
    if (interaction.message && interaction.message.embeds.length > 0) {
      const oldEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
      oldEmbed.setColor(THEME.COLORS.WARNING);
      oldEmbed.setDescription(
        oldEmbed.data.description?.replace(
          /Статус: .*/,
          `Статус: На рассмотрении у ${interaction.user} (\`${interaction.user.tag}\`)`
        ) || null
      );
      await interaction.message.edit({ embeds: [oldEmbed] });
    }
  }

  /**
   * Handle calling candidate to interview by creating a private voice channel
   */
  public static async handleInterview(interaction: ButtonInteraction, applicationId: string): Promise<void> {
    const member = interaction.member as GuildMember;
    if (!(await this.isRecruiter(member))) {
      await interaction.reply({ content: 'У вас нет прав рекрутера для этого действия.', ephemeral: true });
      return;
    }

    const application = await prisma.recruitmentApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      await interaction.reply({ content: 'Заявка не найдена в базе данных.', ephemeral: true });
      return;
    }

    const guild = await this.resolveGuild(interaction);
    if (!guild) {
      await interaction.reply({ content: 'Сервер Discord не найден.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    // Check if voice channel already exists
    if (application.interviewVoiceId) {
      const existingVoice = guild.channels.cache.get(application.interviewVoiceId);
      if (existingVoice) {
        await interaction.editReply({
          content: `Комната для обзвона уже создана: <#${existingVoice.id}>. Перейдите туда для проведения собеседования.`,
        });
        return;
      }
    }

    const recConfig = await prisma.recruitmentConfig.findUnique({ where: { guildId: guild.id } }).catch(() => null);
    let recruiterRoleIds: string[] = [];
    try {
      recruiterRoleIds = JSON.parse(recConfig?.recruiterRoleIds || '[]');
    } catch {
      recruiterRoleIds = [];
    }

    // Permission overwrites: only candidate + recruiters + bot
    const overwrites: any[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
      },
      {
        id: application.userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.UseVAD,
        ],
      },
    ];

    const botUserId = guild.members.me?.id || bot.user?.id;
    if (botUserId) {
      overwrites.push({
        id: botUserId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.MoveMembers,
        ],
      });
    }

    for (const rId of recruiterRoleIds) {
      if (guild.roles.cache.has(rId)) {
        overwrites.push({
          id: rId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
            PermissionFlagsBits.MoveMembers,
          ],
        });
      }
    }

    // Parent category: same as ticket channel or recruitment category
    const ticketChannel = application.channelId ? guild.channels.cache.get(application.channelId) : null;
    const parentId = ticketChannel?.parentId || recConfig?.categoryId || undefined;

    // Create private voice channel
    const candidateMember = await guild.members.fetch(application.userId).catch(() => null);
    const candidateName = candidateMember?.displayName || application.userTag || 'Кандидат';
    const voiceChannel = await guild.channels.create({
      name: `обзвон-${candidateName.slice(0, 15)}`,
      type: ChannelType.GuildVoice,
      parent: parentId,
      permissionOverwrites: overwrites,
    });

    // Save interviewVoiceId to application
    await prisma.recruitmentApplication.update({
      where: { id: applicationId },
      data: {
        interviewVoiceId: voiceChannel.id,
        status: 'UNDER_REVIEW',
        recruiterId: interaction.user.id,
        recruiterTag: interaction.user.tag,
      },
    });

    // Notify in ticket channel
    const alertEmbed = createThemedEmbed({
      title: 'СОБЕСЕДОВАНИЕ • ОБЗВОН КАНДИДАТА',
      color: THEME.COLORS.PRIMARY,
      description: [
        THEME.format.quote(`Рекрутер ${interaction.user} открыл закрытую комнату для обзвона.`),
        '',
        THEME.format.item('Голосовой канал', `<#${voiceChannel.id}>`),
        '',
        THEME.format.subtext(`Доступ разрешен только кандидату <@${application.userId}> и рекрутерам семьи.`),
      ].join('\n'),
      footerText: 'INTERPOL • Собеседование',
    });

    if (ticketChannel && ticketChannel.isTextBased()) {
      const renderedAlert = await BotMessageManager.renderMessage(guild.id, 'recruitment_interview_alert', {
        user: `<@${application.userId}>`,
        username: candidateMember?.user?.username || application.userId,
        recruiter: `<@${interaction.user.id}>`,
        voiceChannel: `<#${voiceChannel.id}>`,
        guild: guild.name,
      });

      await (ticketChannel as TextChannel).send({
        content: renderedAlert.content || `<@${application.userId}> вас ожидают в голосовом канале`,
        embeds: [renderedAlert.embed],
      }).catch(() => null);
    }

    // Try sending DM to candidate
    if (candidateMember) {
      BotMessageManager.sendDM(guild.id, candidateMember, 'recruitment_dm_interview', {
        user: `<@${application.userId}>`,
        username: candidateMember.user?.username || application.userId,
        guild: guild.name,
        recruiter: interaction.user.tag,
        voiceChannel: `<#${voiceChannel.id}>`,
      }).catch(() => null);
    }

    // Audit log
    await AuditLogger.recordEntry({
      guildId: guild.id,
      category: 'RECRUIT',
      action: 'RECRUIT_INTERVIEW_START',
      title: 'Вызов кандидата на обзвон',
      description: `Рекрутер <@${interaction.user.id}> создал приватный войс <#${voiceChannel.id}> для кандидата <@${application.userId}>`,
      executorId: interaction.user.id,
      executorTag: interaction.user.tag,
      targetId: application.userId,
    });

    await interaction.editReply({
      content: `✅ Голосовой канал для обзвона создан: <#${voiceChannel.id}>! Кандидат оповещен.`,
    });
  }

  /**
   * Approve application handler
   */
  public static async handleApprove(interaction: ButtonInteraction, applicationId: string): Promise<void> {
    const member = interaction.member as GuildMember;
    if (!(await this.isRecruiter(member))) {
      await interaction.reply({ content: '❌ У вас нет прав рекрутера для этого действия.', ephemeral: true });
      return;
    }

    const application = await prisma.recruitmentApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      await interaction.reply({ content: '❌ Заявка не найдена.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const guild = await this.resolveGuild(interaction);
    if (!guild) {
      await interaction.editReply({ content: '❌ Сервер Discord не найден.' });
      return;
    }

    const config = await prisma.recruitmentConfig.findUnique({
      where: { guildId: guild.id },
    });

    // 1. Give multiple roles to applicant
    const targetMember = await guild.members.fetch(application.userId).catch(() => null);
    if (targetMember) {
      let roleIdsToGrant: string[] = [];
      try {
        roleIdsToGrant = JSON.parse(config?.memberRoleIdsJson || '[]');
      } catch {
        roleIdsToGrant = [];
      }
      if (config?.memberRoleId && !roleIdsToGrant.includes(config.memberRoleId)) {
        roleIdsToGrant.push(config.memberRoleId);
      }

      for (const rId of roleIdsToGrant) {
        if (typeof rId === 'string' && guild.roles.cache.has(rId)) {
          await targetMember.roles.add(rId).catch(e => {
            console.error(`Failed to grant family role ${rId}:`, e);
          });
        }
      }
    }

    // Auto-create Academy channel for 1st rank MP progression
    if (targetMember) {
      let staticId: string | undefined;
      let candidateName: string | undefined;
      try {
        const answers = JSON.parse(application.answersJson || '{}');
        for (const [key, val] of Object.entries(answers)) {
          const k = key.toLowerCase();
          if (!candidateName && (k.includes('имя') || k.includes('ник') || k.includes('name') || k.includes('rp'))) {
            candidateName = String(val).trim();
          }
          if (!staticId && (k.includes('статик') || k.includes('static') || k.includes('паспорт') || k.includes('id'))) {
            staticId = String(val).replace(/[^\d]/g, '').trim() || String(val).trim();
          }
        }
      } catch {}

      const firstName = extractFirstName(candidateName || targetMember.displayName || targetMember.user.username);

      if (staticId || firstName) {
        await ProfileService.setStatic(
          guild.id,
          targetMember.id,
          staticId || targetMember.id.slice(-5),
          firstName,
          targetMember.user.tag,
          true
        ).catch(() => null);
      }

      await AcademyService.createAcademyChannel(guild, targetMember, staticId, firstName).catch(err => {
        console.warn('[Academy] Could not auto-create academy channel:', err.message);
      });

      // Update Discord nickname strictly to first name without surname
      if (typeof (targetMember as any)?.setNickname === 'function' && targetMember?.manageable && firstName) {
        await targetMember.setNickname(firstName, 'Одобрение заявки в семью (Имя без фамилии)').catch(() => null);
      }

      // Auto-sync nickname according to roles and bound profile
      await NicknameService.syncMemberNickname(targetMember, 'Одобрение заявки в семью').catch(() => null);
    }

    // 2. Send DM notification
    if (targetMember) {
      await BotMessageManager.sendDM(guild.id, targetMember, 'recruitment_dm_accepted', {
        user: `<@${targetMember.id}>`,
        username: targetMember.user?.username || targetMember.id,
        guild: guild.name,
        recruiter: interaction.user.tag,
        role: '@Участник',
      });
    }

    // 3. Update DB
    await prisma.recruitmentApplication.update({
      where: { id: applicationId },
      data: {
        status: 'ACCEPTED',
        recruiterId: interaction.user.id,
        recruiterTag: interaction.user.tag,
        closedAt: new Date(),
      },
    });

    // 4. Generate Transcript and send to log channel
    const channel = interaction.channel as TextChannel;
    const transcriptAttachment = channel ? await TranscriptService.generateTranscript(channel) : null;

    const approvedUserTag = application.userTag || 'Кандидат';
    const logEmbed = createThemedEmbed({
      title: `ЗАЯВКА ОДОБРЕНА • ${approvedUserTag.toUpperCase()}`,
      color: THEME.COLORS.SUCCESS,
      description: [
        THEME.format.quote('Кандидат успешно принят в состав семьи.'),
        '',
        THEME.format.item('Кандидат', `<@${application.userId}> (\`${application.userId}\`)`),
        THEME.format.item('Рекрутер', `${interaction.user} (\`${interaction.user.tag}\`)`),
        THEME.format.item('Канал', `\`#${channel?.name || 'ticket'}\``),
        THEME.format.item('Время', `<t:${Math.floor(Date.now() / 1000)}:F>`),
      ].join('\n'),
      footerText: 'INTERPOL • Набор в семью',
    });

    await this.sendRecruitmentLog(guild, logEmbed, transcriptAttachment ? [transcriptAttachment] : []);

    // Bot log
    const botEmbed = createThemedEmbed({
      title: 'ЗАЯВКА В СЕМЬЮ ОДОБРЕНА',
      color: THEME.COLORS.SUCCESS,
      description: [
        THEME.format.item('Кандидат', `<@${application.userId}> (\`${application.userTag}\`)`),
        THEME.format.item('Рекрутер', `${interaction.user}`),
        THEME.format.item('Время', `<t:${Math.floor(Date.now() / 1000)}:F>`),
      ].join('\n'),
      footerText: 'INTERPOL • Бот-лог',
    });
    await AuditLogger.sendLog(guild, 'BOT', botEmbed);

    await interaction.editReply({
      content: `Заявка одобрена. Роль выдана. Канал будет удален через 5 секунд...`,
    });

    setTimeout(async () => {
      if (application.interviewVoiceId) {
        const vCh = guild.channels.cache.get(application.interviewVoiceId);
        if (vCh) await vCh.delete('Application approved').catch(() => null);
      }
      if (channel && typeof channel.delete === 'function') {
        await channel.delete('Application approved').catch(() => null);
      }
    }, 5000);
  }

  /**
   * Prompt rejection reason modal
   */
  public static async promptRejectModal(interaction: ButtonInteraction, applicationId: string): Promise<void> {
    const member = interaction.member as GuildMember;
    if (!(await this.isRecruiter(member))) {
      await interaction.reply({ content: '❌ У вас нет прав рекрутера для этого действия.', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`recruit_modal_reject_${applicationId}`)
      .setTitle('Укажите причину отказа');

    const reasonInput = new TextInputBuilder()
      .setCustomId('rejection_reason')
      .setLabel('Причина отказа (будет отправлена в ЛС)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Недостаточный онлайн / не подходите по критериям...')
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
    await interaction.showModal(modal);
  }

  /**
   * Process rejection modal submit
   */
  public static async handleRejectSubmit(interaction: ModalSubmitInteraction, applicationId: string): Promise<void> {
    const reason = interaction.fields.getTextInputValue('rejection_reason');
    await interaction.deferReply();

    const guild = await this.resolveGuild(interaction);
    if (!guild) {
      await interaction.editReply({ content: '❌ Сервер Discord не найден.' });
      return;
    }

    const application = await prisma.recruitmentApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      await interaction.editReply({ content: '❌ Заявка не найдена.' });
      return;
    }

    const config = await prisma.recruitmentConfig.findUnique({
      where: { guildId: guild.id },
    });

    const targetMember = await guild.members.fetch(application.userId).catch(() => null);

    // 1. Send DM with rejection reason
    if (targetMember) {
      await BotMessageManager.sendDM(guild.id, targetMember, 'recruitment_dm_rejected', {
        user: `<@${targetMember.id}>`,
        username: targetMember.user?.username || targetMember.id,
        guild: guild.name,
        recruiter: interaction.user.tag,
        reason: reason,
      });

      // Kick member
      await targetMember.kick(`Отказ в заявке: ${reason}`).catch(e => {
        console.error('Failed to kick member:', e);
      });
    }

    // 2. Update DB
    await prisma.recruitmentApplication.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        recruiterId: interaction.user.id,
        recruiterTag: interaction.user.tag,
        closedAt: new Date(),
      },
    });

    // 3. Transcript & Logs
    const channel = interaction.channel as TextChannel;
    const transcriptAttachment = channel ? await TranscriptService.generateTranscript(channel) : null;

    const rejectedUserTag = application.userTag || 'Кандидат';
    const logEmbed = createThemedEmbed({
      title: `ЗАЯВКА ОТКЛОНЕНА • ${rejectedUserTag.toUpperCase()}`,
      color: THEME.COLORS.DANGER,
      description: [
        THEME.format.quote('Заявка кандидата отклонена рекрутером.'),
        '',
        THEME.format.item('Кандидат', `<@${application.userId}> (\`${application.userId}\`)`),
        THEME.format.item('Рекрутер', `${interaction.user} (\`${interaction.user.tag}\`)`),
        THEME.format.item('Причина', reason),
        THEME.format.item('Время', `<t:${Math.floor(Date.now() / 1000)}:F>`),
      ].join('\n'),
      footerText: 'INTERPOL • Набор в семью',
    });

    await this.sendRecruitmentLog(guild, logEmbed, transcriptAttachment ? [transcriptAttachment] : []);

    // Bot log
    const botEmbed = createThemedEmbed({
      title: 'ЗАЯВКА В СЕМЬЮ ОТКЛОНЕНА',
      color: THEME.COLORS.DANGER,
      description: [
        THEME.format.item('Кандидат', `<@${application.userId}> (\`${application.userTag}\`)`),
        THEME.format.item('Рекрутер', `${interaction.user}`),
        THEME.format.item('Причина', reason),
        THEME.format.item('Время', `<t:${Math.floor(Date.now() / 1000)}:F>`),
      ].join('\n'),
      footerText: 'INTERPOL • Бот-лог',
    });
    await AuditLogger.sendLog(guild, 'BOT', botEmbed);

    await interaction.editReply({
      content: `Заявка отклонена. Пользователь кикнут. Канал будет удален через 5 секунд...`,
    });

    setTimeout(async () => {
      if (application.interviewVoiceId) {
        const vCh = guild.channels.cache.get(application.interviewVoiceId);
        if (vCh) await vCh.delete('Application rejected').catch(() => null);
      }
      if (channel && typeof channel.delete === 'function') {
        await channel.delete('Application rejected').catch(() => null);
      }
    }, 5000);
  }
}
