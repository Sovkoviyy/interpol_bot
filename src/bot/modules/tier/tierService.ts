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
import { BotMessageManager } from '../../utils/botMessageManager';

export const TIER_MP_TYPES = ['Капт', 'ВЗЗ / МЦЛ', 'Арена', 'РП'] as const;
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

    // 1. Find or create Tier Checker / Reviewer role
    let checkerRole = config.checkerRoleId
      ? guild.roles.cache.get(config.checkerRoleId) || await guild.roles.fetch(config.checkerRoleId).catch(() => null)
      : null;

    if (!checkerRole) {
      checkerRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'чекер откатов' || r.name.toLowerCase() === 'тир чекер' || r.name.toLowerCase() === 'tier checker') || null;
    }

    if (!checkerRole) {
      checkerRole = await guild.roles.create({
        name: 'Чекер откатов',
        color: 0xEC4899,
        reason: 'Роль для проверки и разбора откатов с МП',
      });
    }

    // 2. Find or create Category "ОТКАТЫ С МП"
    let category = config.categoryId
      ? (guild.channels.cache.get(config.categoryId) as CategoryChannel) || null
      : null;

    if (!category || category.type !== ChannelType.GuildCategory) {
      category = (guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && (c.name.toLowerCase() === 'откаты с мп' || c.name.toLowerCase() === 'заявки на тир' || c.name.toLowerCase() === 'тир')
      ) as CategoryChannel) || null;
    }

    if (!category) {
      category = await guild.channels.create({
        name: 'ОТКАТЫ С МП',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          },
        ],
      });
    }

    // 3. Find or create Apply Channel "сдать-откат"
    let applyChannel = config.applyChannelId
      ? (guild.channels.cache.get(config.applyChannelId) as TextChannel) || null
      : null;

    if (!applyChannel || applyChannel.type !== ChannelType.GuildText) {
      applyChannel = (guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && c.parentId === category!.id && (c.name === 'сдать-откат' || c.name === 'заявки-на-тир' || c.name === 'подача-тир')
      ) as TextChannel) || null;
    }

    if (!applyChannel) {
      applyChannel = await guild.channels.create({
        name: 'сдать-откат',
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

    // 4. Find or create Review Channel "разбор-откатов"
    let reviewChannel = config.reviewChannelId
      ? (guild.channels.cache.get(config.reviewChannelId) as TextChannel) || null
      : null;

    if (!reviewChannel || reviewChannel.type !== ChannelType.GuildText) {
      reviewChannel = (guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && c.parentId === category!.id && (c.name === 'разбор-откатов' || c.name === 'проверка-тир' || c.name === 'тир-чекеры')
      ) as TextChannel) || null;
    }

    if (!reviewChannel) {
      reviewChannel = await guild.channels.create({
        name: 'разбор-откатов',
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
    const rendered = await BotMessageManager.renderMessage(guild.id, 'tier_apply_panel', {
      guild: guild.name,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tier_request_channel_btn')
        .setLabel('📹 Сдать откат с МП')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎯')
    );

    const msg = await channel.send({
      content: rendered.content,
      embeds: [rendered.embed],
      components: [row],
    });

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
            content: `ℹ️ У вас уже есть активный канал для сдачи откатов: <#${existingTicket.channelId}>. Перейдите в него для отправки откатов.`,
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
      const channelName = `откаты-${cleanName || interaction.user.username}`.toLowerCase().slice(0, 30);

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
      const introRendered = await BotMessageManager.renderMessage(guild.id, 'tier_ticket_intro', {
        user: `<@${interaction.user.id}>`,
        username: interaction.user.username,
        guild: guild.name,
      });

      await ticketChannel.send({
        content: introRendered.content || `<@${interaction.user.id}>`,
        embeds: [introRendered.embed],
      });

      // Send 4 distinct messages & create 4 threads for the MP types
      for (const mpType of TIER_MP_TYPES) {
        const mpRendered = await BotMessageManager.renderMessage(guild.id, 'tier_ticket_mp_section', {
          mpType,
          guild: guild.name,
        });

        const mpMessage = await ticketChannel.send({ embeds: [mpRendered.embed] });

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

      // Send DM notification to candidate
      BotMessageManager.sendDM(guild.id, interaction.user.id, 'tier_dm_created', {
        user: `<@${interaction.user.id}>`,
        username: interaction.user.username,
        guild: guild.name,
        channelId: ticketChannel.id,
      }).catch(() => null);

      // Log action to #бот-лог
      await AuditLogger.recordEntry({
        guildId: guild.id,
        action: 'TIER_CHANNEL_CREATE',
        category: 'BOT',
        title: 'Создан канал для сдачи откатов',
        description: `Участник <@${interaction.user.id}> (\`${interaction.user.tag}\`) открыл канал для сдачи откатов <#${ticketChannel.id}>`,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        targetId: ticketChannel.id,
      }).catch(() => null);

      await interaction.editReply({
        content: `✅ Ваш персональный канал для сдачи откатов создан: <#${ticketChannel.id}>. Перейдите в него для отправки откатов с МП!`,
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
        await interaction.editReply({ content: '❌ Тикет сдачи откатов не найден в базе данных.' });
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
        title: `ОТКАТ ПРИНЯТ НА РАЗБОР • ${mpType.toUpperCase()}`,
        color: THEME.COLORS.PRIMARY,
        description: [
          THEME.format.quote('Ваш откат успешно передан проверяющим на разбор ошибок.'),
          '',
          THEME.format.item('Участник', `<@${interaction.user.id}>`),
          THEME.format.item('Мероприятие', `**${mpType}**`),
          THEME.format.item('Ссылка', `[Смотреть откат](${clipUrl})`),
          comment ? THEME.format.item('Комментарий', comment) : '',
          '',
          THEME.format.subtext('Ожидайте разбора ошибок и рекомендаций от опытных стрелков в этой ветке.'),
        ].filter(Boolean).join('\n'),
      });

      if (interaction.channel && interaction.channel.isThread()) {
        await interaction.channel.send({
          embeds: [threadConfirmEmbed],
        });
      }

      // Dispatch to #разбор-откатов
      const config = await this.getConfig(guild.id);
      let reviewChannel: TextChannel | null = null;
      if (config.reviewChannelId) {
        reviewChannel = (guild.channels.cache.get(config.reviewChannelId) as TextChannel) || null;
      }

      if (reviewChannel && reviewChannel.isTextBased()) {
        const reviewEmbed = createThemedEmbed({
          title: `НОВЫЙ ОТКАТ С МП • ${mpType.toUpperCase()}`,
          color: THEME.COLORS.PRIMARY,
          description: [
            THEME.format.quote('Поступил новый откат с МП на разбор ошибок и оценку стрельбы.'),
            '',
            THEME.format.item('Участник', `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`),
            THEME.format.item('Мероприятие', `**${mpType}**`),
            THEME.format.item('Ссылка на откат', `[Перейти к видеозаписи](${clipUrl})`),
            THEME.format.item('Канал участника', `<#${ticket.channelId}>`),
            comment ? THEME.format.item('Комментарий участника', comment) : '',
            '',
            THEME.format.item('Статус', '`⏳ Ожидает разбора`'),
          ].filter(Boolean).join('\n'),
          footerText: `ID отчета: ${submission.id}`,
        });

        const reviewRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`tier_review_btn_${submission.id}`)
            .setLabel('Разобрать ошибки / Оставить комментарий')
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
        title: `Сдан откат с МП [${mpType}]`,
        description: `Участник <@${interaction.user.id}> (\`${interaction.user.tag}\`) отправил откат с МП **${mpType}** на разбор ошибок.`,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        metadata: { submissionId: submission.id, mpType, clipUrl },
      }).catch(() => null);

      await interaction.editReply({
        content: `✅ Ваш откат с мероприятия **${mpType}** успешно отправлен проверяющим на разбор ошибок!`,
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
      .setTitle(`Разбор отката [${submission.mpType}]`);

    const commentInput = new TextInputBuilder()
      .setCustomId('reviewer_comment')
      .setLabel('Разбор ошибок и рекомендации к откату')
      .setPlaceholder('Опишите ошибки по позиционке, стрельбе, таймингам, советы и замечания...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput)
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
          reviewerComment: reviewerComment,
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
              title: `ОТКАТ С МП • ${submission.mpType.toUpperCase()} • РАЗОБРАН`,
              color: THEME.COLORS.SUCCESS,
              description: [
                THEME.format.quote('Откат проверен и разобран опытным участником семьи.'),
                '',
                THEME.format.item('Участник', `<@${submission.userId}> (\`${submission.userTag}\`)`),
                THEME.format.item('Мероприятие', `**${submission.mpType}**`),
                THEME.format.item('Ссылка на откат', `[Перейти к видеозаписи](${submission.clipUrl})`),
                submission.comment ? THEME.format.item('Комментарий участника', submission.comment) : '',
                THEME.format.item('Кто разобрал', `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`),
                '',
                THEME.format.item('Разбор ошибок и рекомендации', reviewerComment),
                '',
                THEME.format.item('Статус', '`✅ Разобран`'),
              ].filter(Boolean).join('\n'),
              footerText: `ID: ${submission.id} • Разобрано <t:${Math.floor(Date.now() / 1000)}:R>`,
            });

            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`tier_reviewed_${submission.id}`)
                .setLabel('Разобран')
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

      const candidateEmbed = createThemedEmbed({
        title: `📝 РАЗБОР ОТКАТА • ${submission.mpType.toUpperCase()}`,
        color: THEME.COLORS.SUCCESS,
        description: [
          THEME.format.quote(`Опытный стрелок семьи <@${interaction.user.id}> разобрал ваш откат с мероприятия **${submission.mpType}**:`),
          '',
          `**Разбор ошибок и рекомендации:**`,
          `> ${reviewerComment}`,
          '',
          THEME.format.subtext('Ознакомьтесь с замечаниями и применяйте советы в следующих перестрелках!'),
        ].join('\n'),
      });

      if (targetChannel && typeof targetChannel.send === 'function') {
        await targetChannel.send({
          content: `<@${submission.userId}>`,
          embeds: [candidateEmbed],
        }).catch(() => null);
      }

      // Send DM to candidate
      const targetMember = await guild.members.fetch(submission.userId).catch(() => null);
      if (targetMember) {
        const candidateDmEmbed = createThemedEmbed({
          title: `📝 Разбор вашего отката с ${submission.mpType} • ${guild.name}`,
          color: THEME.COLORS.SUCCESS,
          description: [
            `Привет, <@${submission.userId}>!`,
            '',
            `Опытный участник семьи <@${interaction.user.id}> разобрал твой откат с мероприятия **${submission.mpType}**:`,
            '',
            `**Разбор ошибок:**`,
            `> ${reviewerComment}`,
          ].join('\n'),
        });
        await targetMember.send({ embeds: [candidateDmEmbed] }).catch(() => null);
      }

      // 3. Log to AuditLogger in #бот-лог
      await AuditLogger.recordEntry({
        guildId: guild.id,
        action: 'TIER_CLIP_REVIEWED',
        category: 'BOT',
        title: `Разобран откат с МП [${submission.mpType}]`,
        description: `Опытный участник <@${interaction.user.id}> (\`${interaction.user.tag}\`) разобрал откат участника <@${submission.userId}>.`,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        targetId: submission.userId,
        metadata: { submissionId: submission.id, mpType: submission.mpType },
      }).catch(() => null);

      await interaction.editReply({
        content: `✅ Разбор ошибок успешно сохранен, отметка «Разобран» проставлена, а участник уведомлен в своей ветке и в ЛС!`,
      });
    } catch (err: any) {
      console.error('[TierService handleReviewModalSubmit Error]:', err);
      await interaction.editReply({
        content: `❌ Ошибка при сохранении проверки: ${err.message}`,
      });
    }
  }
}
