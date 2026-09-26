import {
  Guild,
  GuildMember,
  TextChannel,
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
  CategoryChannel,
} from 'discord.js';
import prisma from '../../../database/client';
import { AuditLogger } from '../logging/auditLogger';
import { ProfileService } from '../profiles/profileService';
import bot from '../../client';
import { THEME, createThemedEmbed } from '../../utils/theme';
import { sanitizeChannelNamePart } from '../../utils/nameUtils';

export const TIER_MP_TYPES = ['Капт', 'MCL', 'ВЗЗ', 'РП'] as const;
export type TierMpType = typeof TIER_MP_TYPES[number];

export class TierService {
  /**
   * Get or create guild tier configuration
   */
  public static async getConfig(guildId: string) {
    let config = await prisma.tierConfig.findUnique({ where: { guildId } });
    if (!config) {
      config = await prisma.tierConfig.create({
        data: {
          guildId,
          enabled: true,
        },
      });
    }
    return config;
  }

  /**
   * Setup Tier category, apply channel, and checker review channel
   */
  public static async setupTierStructure(guild: Guild): Promise<{
    categoryId: string;
    applyChannelId: string;
    reviewChannelId: string;
    checkerRoleId: string;
  }> {
    const config = await this.getConfig(guild.id);

    // 1. Find or create Tier Checker role
    let checkerRole = config.checkerRoleId
      ? guild.roles.cache.get(config.checkerRoleId) || await guild.roles.fetch(config.checkerRoleId).catch(() => null)
      : null;

    if (!checkerRole) {
      checkerRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'тир чекер' || r.name.toLowerCase() === 'tier checker') || null;
    }

    if (!checkerRole) {
      checkerRole = await guild.roles.create({
        name: 'Тир чекер',
        color: 0xEC4899,
        reason: 'Роль для проверки заявок и откатов на тир',
      });
    }

    // 2. Find or create Category "ЗАЯВКИ НА ТИР"
    let category = config.categoryId
      ? (guild.channels.cache.get(config.categoryId) as CategoryChannel) || null
      : null;

    if (!category || category.type !== ChannelType.GuildCategory) {
      category = (guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && (c.name.toLowerCase() === 'заявки на тир' || c.name.toLowerCase() === 'тир')
      ) as CategoryChannel) || null;
    }

    if (!category) {
      category = await guild.channels.create({
        name: 'ЗАЯВКИ НА ТИР',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          },
        ],
      });
    }

    // 3. Find or create Apply Channel "заявки-на-тир"
    let applyChannel = config.applyChannelId
      ? (guild.channels.cache.get(config.applyChannelId) as TextChannel) || null
      : null;

    if (!applyChannel || applyChannel.type !== ChannelType.GuildText) {
      applyChannel = (guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && c.parentId === category!.id && (c.name === 'заявки-на-тир' || c.name === 'подача-тир')
      ) as TextChannel) || null;
    }

    if (!applyChannel) {
      applyChannel = await guild.channels.create({
        name: 'заявки-на-тир',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [PermissionFlagsBits.SendMessages],
          },
        ],
      });
    }

    // 4. Find or create Review Channel "проверка-тир" (Private for Tier Checkers & Admins)
    let reviewChannel = config.reviewChannelId
      ? (guild.channels.cache.get(config.reviewChannelId) as TextChannel) || null
      : null;

    if (!reviewChannel || reviewChannel.type !== ChannelType.GuildText) {
      reviewChannel = (guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && c.parentId === category!.id && (c.name === 'проверка-тир' || c.name === 'тир-чекеры')
      ) as TextChannel) || null;
    }

    if (!reviewChannel) {
      reviewChannel = await guild.channels.create({
        name: 'проверка-тир',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: checkerRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
            ],
          },
        ],
      });
    }

    // 5. Update database config
    await prisma.tierConfig.update({
      where: { guildId: guild.id },
      data: {
        categoryId: category.id,
        applyChannelId: applyChannel.id,
        reviewChannelId: reviewChannel.id,
        checkerRoleId: checkerRole.id,
      },
    });

    // 6. Deploy initial apply panel
    await this.deployApplyPanel(applyChannel, guild);

    return {
      categoryId: category.id,
      applyChannelId: applyChannel.id,
      reviewChannelId: reviewChannel.id,
      checkerRoleId: checkerRole.id,
    };
  }

  /**
   * Deploy the main Tier apply message with button in #заявки-на-тир
   */
  public static async deployApplyPanel(channel: TextChannel, guild: Guild): Promise<string> {
    const embed = createThemedEmbed({
      title: '🎯 ЗАЯВКИ НА ТИР • ОЦЕНКА СТРЕЛЬБЫ',
      color: THEME.COLORS.PRIMARY,
      description: [
        THEME.format.quote(`Добро пожаловать в систему подачи заявок на получение тира семьи **${guild.name}**!`),
        '',
        '### Порядок подачи:',
        '1. Нажмите на кнопку **«Подать заявку на тир»** ниже.',
        '2. Бот создаст для вас персональный закрытый канал с 4 ветками мероприятий:',
        '   • **Капт** — откаты со стрельбы на каптах',
        '   • **MCL** — откаты с турнирных матчей MCL',
        '   • **ВЗЗ** — откаты с Войны за Заводы / Бизнесы',
        '   • **РП** — откаты со стрельбы и файтов на RP-ситуациях',
        '3. Отправьте откаты в соответствующие ветки с помощью встроенной формы.',
        '4. Тир-чекеры оценят стрельбу, оставят развернутый комментарий и присвоят тир.',
        '',
        '-# Нажмите кнопку ниже для создания личного канала заявки.',
      ].join('\n'),
      thumbnailUrl: typeof guild.iconURL === 'function' ? guild.iconURL({ size: 256 }) : undefined,
      footerText: `${guild.name} • Tier System`,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tier_request_channel_btn')
        .setLabel('Подать заявку на тир')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎯')
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });

    await prisma.tierConfig.update({
      where: { guildId: guild.id },
      data: { applyMessageId: msg.id },
    }).catch(() => null);

    return msg.id;
  }

  /**
   * Handle user clicking "Подать заявку на тир" -> creates private channel with 4 threads
   */
  public static async handleRequestChannel(interaction: ButtonInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: '❌ Сервер не найден.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const config = await this.getConfig(guild.id);

      // Verify category exists
      let categoryId = config.categoryId;
      if (!categoryId || !guild.channels.cache.has(categoryId)) {
        const setup = await this.setupTierStructure(guild);
        categoryId = setup.categoryId;
      }

      // Check if user already has an active open ticket
      const existingTicket = await prisma.tierTicket.findFirst({
        where: {
          guildId: guild.id,
          userId: interaction.user.id,
          status: 'OPEN',
        },
      });

      if (existingTicket) {
        const existingChannel = guild.channels.cache.get(existingTicket.channelId);
        if (existingChannel) {
          await interaction.editReply({
            content: `ℹ️ У вас уже есть активный канал для подачи на тир: <#${existingTicket.channelId}>. Перейдите в него для отправки откатов.`,
          });
          return;
        } else {
          // If channel was manually deleted, mark ticket as closed
          await prisma.tierTicket.update({
            where: { id: existingTicket.id },
            data: { status: 'CLOSED' },
          });
        }
      }

      // Get user profile for static/name
      const profile = await ProfileService.getOrCreateProfile(guild.id, interaction.user.id, interaction.user.tag);
      const cleanName = profile.characterName ? sanitizeChannelNamePart(profile.characterName) : sanitizeChannelNamePart(interaction.user.username);
      const channelName = `тир-${cleanName || interaction.user.username}`.toLowerCase().slice(0, 30);

      // Setup permission overwrites
      const checkerRoleId = config.checkerRoleId;
      const overwrites: any[] = [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.CreatePublicThreads,
            PermissionFlagsBits.SendMessagesInThreads,
          ],
        },
      ];

      if (checkerRoleId && guild.roles.cache.has(checkerRoleId)) {
        overwrites.push({
          id: checkerRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.SendMessagesInThreads,
          ],
        });
      }

      if (guild.members.me) {
        overwrites.push({
          id: guild.members.me.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageThreads,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }

      // Create personal channel
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: overwrites,
      });

      // Save ticket in DB
      const ticket = await prisma.tierTicket.create({
        data: {
          guildId: guild.id,
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          channelId: ticketChannel.id,
          status: 'OPEN',
        },
      });

      // Send Intro Message in the ticket channel
      const introEmbed = createThemedEmbed({
        title: `🎯 ЗАЯВКА НА ТИР • ${interaction.user.username.toUpperCase()}`,
        color: THEME.COLORS.PRIMARY,
        description: [
          THEME.format.quote(`Канал создан для кандидата <@${interaction.user.id}>.`),
          '',
          '### Инструкция по отправке откатов:',
          'Ниже бот опубликовал 4 сообщения по категориям мероприятий:',
          '1. **Капт** — ветка для откатов со стрельбы на каптах.',
          '2. **MCL** — ветка для турнирных откатов MCL.',
          '3. **ВЗЗ** — ветка для откатов с Войны за Заводы.',
          '4. **РП** — ветка для RP-файтов и ситуаций.',
          '',
          'Перейдите в нужную ветку под каждым сообщением, нажмите кнопку **«Сдать откат»** и укажите ссылку на видео.',
          'Тир-чекеры проверят ваши записи и ответят прямо в ветках с комментариями.',
        ].join('\n'),
      });

      await ticketChannel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [introEmbed],
      });

      // Send 4 distinct messages & create 4 threads for the MP types
      for (const mpType of TIER_MP_TYPES) {
        const mpEmbed = createThemedEmbed({
          title: `ОТКАТЫ • ${mpType.toUpperCase()}`,
          color: THEME.COLORS.ACCENT,
          description: [
            THEME.format.quote(`Раздел для откатов с мероприятия **${mpType}**.`),
            '',
            `Для сдачи отката перейдите в прикрепленную ветку ниже и нажмите кнопку сдачи.`,
          ].join('\n'),
        });

        const mpMessage = await ticketChannel.send({ embeds: [mpEmbed] });

        // Start thread on this message
        const thread = await mpMessage.startThread({
          name: `Откаты — ${mpType}`,
          autoArchiveDuration: 10080, // 7 days
          reason: `Ветка для сдачи откатов с мероприятия ${mpType}`,
        });

        // Send submission button inside the thread
        const formEmbed = createThemedEmbed({
          title: `СДАЧА ОТКАТА • ${mpType.toUpperCase()}`,
          color: THEME.COLORS.PRIMARY,
          description: [
            THEME.format.quote(`Нажмите кнопку ниже, чтобы прикрепить видеозапись с **${mpType}**.`),
            '',
            '• Запись должна быть в хорошем качестве со звуками игры.',
            '• Принимаются ссылки на **YouTube** или **Streamable**.',
            '• Вы можете сдавать несколько откатов по мере участия в МП.',
          ].join('\n'),
        });

        const submitRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`tier_clip_btn_${encodeURIComponent(mpType)}_${ticket.id}`)
            .setLabel(`Сдать откат [${mpType}]`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📹')
        );

        await thread.send({
          embeds: [formEmbed],
          components: [submitRow],
        });
      }

      // Log action to #бот-лог
      await AuditLogger.recordEntry({
        guildId: guild.id,
        action: 'TIER_CHANNEL_CREATE',
        category: 'BOT',
        title: 'Создан канал заявки на тир',
        description: `Кандидат <@${interaction.user.id}> (\`${interaction.user.tag}\`) открыл канал заявки на тир <#${ticketChannel.id}>`,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        targetId: ticketChannel.id,
      }).catch(() => null);

      await interaction.editReply({
        content: `✅ Ваш персональный канал для подачи на тир создан: <#${ticketChannel.id}>. Перейдите в него для сдачи откатов!`,
      });
    } catch (err: any) {
      console.error('[TierService handleRequestChannel Error]:', err);
      await interaction.editReply({
        content: `❌ Произошла ошибка при создании канала: ${err.message}`,
      });
    }
  }

  /**
   * Handle user clicking "Сдать откат [MP]" -> displays clip submission modal
   */
  public static async handleSubmitClipButton(
    interaction: ButtonInteraction,
    mpType: string,
    ticketId: string
  ): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId(`tier_clip_modal_${encodeURIComponent(mpType)}_${ticketId}`)
      .setTitle(`Сдача отката [${mpType}]`);

    const clipUrlInput = new TextInputBuilder()
      .setCustomId('clip_url')
      .setLabel('Ссылка на откат (YouTube, Streamable)')
      .setPlaceholder('https://youtu.be/... или https://streamable.com/...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const commentInput = new TextInputBuilder()
      .setCustomId('clip_comment')
      .setLabel('Комментарий / таймкоды ключевых моментов')
      .setPlaceholder('Таймкоды перестрелок, описание ситуации, позиционка...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(clipUrlInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput)
    );

    await interaction.showModal(modal);
  }

  /**
   * Handle modal submission with clip URL and comment
   */
  public static async handleClipModalSubmit(
    interaction: ModalSubmitInteraction,
    mpType: string,
    ticketId: string
  ): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: '❌ Сервер не найден.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const clipUrl = interaction.fields.getTextInputValue('clip_url').trim();
      const comment = interaction.fields.getTextInputValue('clip_comment')?.trim() || null;

      if (!clipUrl.startsWith('http://') && !clipUrl.startsWith('https://')) {
        await interaction.editReply({
          content: '❌ Ссылка на откат должна начинаться с `http://` или `https://`.',
        });
        return;
      }

      const ticket = await prisma.tierTicket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        await interaction.editReply({ content: '❌ Заявка на тир не найдена в базе данных.' });
        return;
      }

      // Create submission in DB
      const submission = await prisma.tierSubmission.create({
        data: {
          ticketId: ticket.id,
          guildId: guild.id,
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          channelId: ticket.channelId,
          threadId: interaction.channelId || null,
          mpType,
          clipUrl,
          comment,
          status: 'PENDING',
        },
      });

      // Send confirmation message in the thread
      const threadConfirmEmbed = createThemedEmbed({
        title: `ОТКАТ ПРИНЯТ НА ПРОВЕРКУ • ${mpType.toUpperCase()}`,
        color: THEME.COLORS.PRIMARY,
        description: [
          THEME.format.quote('Ваш откат успешно передан тир-чекерам на проверку.'),
          '',
          THEME.format.item('Кандидат', `<@${interaction.user.id}>`),
          THEME.format.item('Мероприятие', `**${mpType}**`),
          THEME.format.item('Ссылка', `[Смотреть откат](${clipUrl})`),
          comment ? THEME.format.item('Комментарий', comment) : '',
          '',
          THEME.format.subtext('Ожидайте комментария и вердикта тир-чекера в этой ветке.'),
        ].filter(Boolean).join('\n'),
      });

      if (interaction.channel && interaction.channel.isThread()) {
        await interaction.channel.send({
          embeds: [threadConfirmEmbed],
        });
      }

      // Dispatch to #проверка-тир
      const config = await this.getConfig(guild.id);
      let reviewChannel: TextChannel | null = null;
      if (config.reviewChannelId) {
        reviewChannel = (guild.channels.cache.get(config.reviewChannelId) as TextChannel) || null;
      }

      if (reviewChannel && reviewChannel.isTextBased()) {
        const reviewEmbed = createThemedEmbed({
          title: `НОВЫЙ ОТКАТ НА ТИР • ${mpType.toUpperCase()}`,
          color: THEME.COLORS.PRIMARY,
          description: [
            THEME.format.quote('Поступил новый откат на оценку стрельбы и тира.'),
            '',
            THEME.format.item('Кандидат', `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`),
            THEME.format.item('Мероприятие', `**${mpType}**`),
            THEME.format.item('Ссылка на откат', `[Перейти к видеозаписи](${clipUrl})`),
            THEME.format.item('Канал кандидата', `<#${ticket.channelId}>`),
            comment ? THEME.format.item('Комментарий кандидата', comment) : '',
            '',
            THEME.format.item('Статус', '`⏳ Ожидает проверки`'),
          ].filter(Boolean).join('\n'),
          footerText: `ID отчета: ${submission.id}`,
        });

        const reviewRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`tier_review_btn_${submission.id}`)
            .setLabel('Проверить / Оставить комментарий')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝')
        );

        const reviewMsg = await reviewChannel.send({
          content: config.checkerRoleId ? `<@&${config.checkerRoleId}>` : undefined,
          embeds: [reviewEmbed],
          components: [reviewRow],
        });

        await prisma.tierSubmission.update({
          where: { id: submission.id },
          data: { reviewMessageId: reviewMsg.id },
        });
      }

      // Audit log to #бот-лог
      await AuditLogger.recordEntry({
        guildId: guild.id,
        action: 'TIER_CLIP_SUBMIT',
        category: 'BOT',
        title: `Сдан откат на тир [${mpType}]`,
        description: `Кандидат <@${interaction.user.id}> (\`${interaction.user.tag}\`) отправил откат с МП **${mpType}** на проверку.`,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        metadata: { submissionId: submission.id, mpType, clipUrl },
      }).catch(() => null);

      await interaction.editReply({
        content: `✅ Ваш откат с мероприятия **${mpType}** успешно отправлен тир-чекерам на рассмотрение!`,
      });
    } catch (err: any) {
      console.error('[TierService handleClipModalSubmit Error]:', err);
      await interaction.editReply({
        content: `❌ Ошибка при отправке отката: ${err.message}`,
      });
    }
  }

  /**
   * Handle Tier Checker clicking "Проверить / Оставить комментарий"
   */
  public static async handleReviewButton(
    interaction: ButtonInteraction,
    submissionId: string
  ): Promise<void> {
    const guild = interaction.guild;
    const member = interaction.member as GuildMember;

    if (!guild || !member) {
      await interaction.reply({ content: '❌ Ошибка определения пользователя.', ephemeral: true });
      return;
    }

    // Permission check: Tier Checker role or Administrator
    const config = await this.getConfig(guild.id);
    const hasCheckerRole = config.checkerRoleId && member.roles.cache.has(config.checkerRoleId);
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

    if (!hasCheckerRole && !isAdmin) {
      await interaction.reply({
        content: '❌ Только проверяющие с ролью **Тир чекер** или Администраторы могут проверять отчеты.',
        ephemeral: true,
      });
      return;
    }

    const submission = await prisma.tierSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      await interaction.reply({ content: '❌ Отчет не найден в базе данных.', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`tier_review_modal_${submission.id}`)
      .setTitle(`Проверка отката [${submission.mpType}]`);

    const commentInput = new TextInputBuilder()
      .setCustomId('reviewer_comment')
      .setLabel('Комментарий / замечания к стрельбе')
      .setPlaceholder('Напишите обратную связь, разбор позиционки, стрельбы, рекомендации...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const tierInput = new TextInputBuilder()
      .setCustomId('assigned_tier')
      .setLabel('Присвоенный тир / статус (опционально)')
      .setPlaceholder('например: Tier 1, Tier 2, Требуются еще откаты...')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(tierInput)
    );

    await interaction.showModal(modal);
  }

  /**
   * Handle Tier Checker modal submission
   */
  public static async handleReviewModalSubmit(
    interaction: ModalSubmitInteraction,
    submissionId: string
  ): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: '❌ Сервер не найден.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const reviewerComment = interaction.fields.getTextInputValue('reviewer_comment').trim();
      const assignedTier = interaction.fields.getTextInputValue('assigned_tier')?.trim() || null;

      const submission = await prisma.tierSubmission.findUnique({
        where: { id: submissionId },
        include: { ticket: true },
      });

      if (!submission) {
        await interaction.editReply({ content: '❌ Отчет не найден.' });
        return;
      }

      // Update in DB
      const updated = await prisma.tierSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'REVIEWED',
          reviewerId: interaction.user.id,
          reviewerTag: interaction.user.tag,
          reviewerComment: assignedTier ? `[${assignedTier}] ${reviewerComment}` : reviewerComment,
          reviewedAt: new Date(),
        },
      });

      // 1. Update review message in #проверка-тир
      if (submission.reviewMessageId) {
        const config = await this.getConfig(guild.id);
        const reviewChannel = config.reviewChannelId
          ? (guild.channels.cache.get(config.reviewChannelId) as TextChannel) || null
          : null;

        if (reviewChannel) {
          const reviewMsg = await reviewChannel.messages.fetch(submission.reviewMessageId).catch(() => null);
          if (reviewMsg) {
            const updatedEmbed = createThemedEmbed({
              title: `ОТКАТ НА ТИР • ${submission.mpType.toUpperCase()} • ПРОСМОТРЕН`,
              color: THEME.COLORS.SUCCESS,
              description: [
                THEME.format.quote('Откат проверен тир-чекером.'),
                '',
                THEME.format.item('Кандидат', `<@${submission.userId}> (\`${submission.userTag}\`)`),
                THEME.format.item('Мероприятие', `**${submission.mpType}**`),
                THEME.format.item('Ссылка на откат', `[Перейти к видеозаписи](${submission.clipUrl})`),
                submission.comment ? THEME.format.item('Комментарий кандидата', submission.comment) : '',
                THEME.format.item('Проверяющий', `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`),
                assignedTier ? THEME.format.item('Вердикт / Тир', `**${assignedTier}**`) : '',
                THEME.format.item('Комментарий проверяющего', reviewerComment),
                '',
                THEME.format.item('Статус', '`✅ Просмотрен`'),
              ].filter(Boolean).join('\n'),
              footerText: `ID: ${submission.id} • Проверено <t:${Math.floor(Date.now() / 1000)}:R>`,
            });

            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`tier_reviewed_${submission.id}`)
                .setLabel('Просмотрен')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
                .setEmoji('✅')
            );

            if (typeof (reviewMsg as any).edit === 'function') {
              await (reviewMsg as any).edit({ embeds: [updatedEmbed], components: [disabledRow] }).catch(() => null);
            }
          }
        }
      }

      // 2. Send notification to candidate in their ticket thread or channel
      const targetChannelId = submission.threadId || submission.channelId;
      const targetChannel = (guild.channels.cache.get(targetChannelId) ||
        await guild.channels.fetch(targetChannelId).catch(() => null)) as any;

      if (targetChannel && typeof targetChannel.send === 'function') {
        const candidateNotificationEmbed = createThemedEmbed({
          title: `🎯 ОТВЕТ ТИР-ЧЕКЕРА • ${submission.mpType.toUpperCase()}`,
          color: THEME.COLORS.SUCCESS,
          description: [
            THEME.format.quote(`Проверяющий <@${interaction.user.id}> рассмотрел ваш откат с мероприятия **${submission.mpType}**!`),
            '',
            assignedTier ? THEME.format.item('Вердикт / Присвоенный тир', `**${assignedTier}**`) : '',
            THEME.format.item('Комментарий проверяющего', reviewerComment),
            THEME.format.item('Ссылка на ваш откат', `[Перейти к видеозаписи](${submission.clipUrl})`),
            '',
            THEME.format.item('Статус', '`✅ Просмотрен`'),
            '',
            THEME.format.subtext('Вы можете продолжать отправлять откаты с других мероприятий в соответствующие ветки.'),
          ].filter(Boolean).join('\n'),
          footerText: 'INTERPOL • Tier System',
        });

        await targetChannel.send({
          content: `<@${submission.userId}>`,
          embeds: [candidateNotificationEmbed],
        }).catch(() => null);
      }

      // 3. Log to AuditLogger in #бот-лог
      await AuditLogger.recordEntry({
        guildId: guild.id,
        action: 'TIER_CLIP_REVIEWED',
        category: 'BOT',
        title: `Проверен откат на тир [${submission.mpType}]`,
        description: `Тир-чекер <@${interaction.user.id}> (\`${interaction.user.tag}\`) проверил откат кандидата <@${submission.userId}>. Вердикт: ${assignedTier || 'Без тира'}.`,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        targetId: submission.userId,
        metadata: { submissionId: submission.id, mpType: submission.mpType, assignedTier },
      }).catch(() => null);

      await interaction.editReply({
        content: `✅ Комментарий к отчету успешно сохранен, отметка «Просмотрен» проставлена, а кандидат уведомлен в своем канале!`,
      });
    } catch (err: any) {
      console.error('[TierService handleReviewModalSubmit Error]:', err);
      await interaction.editReply({
        content: `❌ Ошибка при сохранении проверки: ${err.message}`,
      });
    }
  }
}
