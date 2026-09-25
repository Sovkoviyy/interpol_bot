import { 
  Guild, 
  ChannelType, 
  PermissionFlagsBits, 
  TextChannel, 
  VoiceChannel, 
  CategoryChannel, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import bot from '../../client';
import prisma from '../../../database/client';
import { AuditLogger } from '../logging/auditLogger';
import { ProfileService } from '../profiles/profileService';
import { LeaveService } from '../leave/leaveService';
import { THEME, createThemedEmbed } from '../../utils/theme';

export interface ProvisionResult {
  guildId: string;
  guildName: string;
  categoriesCreated: string[];
  channelsCreated: string[];
  panelsDeployed: string[];
  channels: {
    welcomeChannelId: string;
    staticBindingChannelId: string;
    leaveRequestChannelId: string;
    recruitmentApplyChannelId: string;
    recruitmentReviewChannelId: string;
    eventAnnounceChannelId: string;
    voiceChannelId: string;
    academyCategoryId: string;
    academyArchiveCategoryId: string;
    logsCategoryId: string;
  };
}

export class ServerSetupService {
  /**
   * List all Discord guilds where the bot is joined
   */
  public static listGuilds() {
    return bot.guilds.cache.map(g => {
      const me = g.members.me;
      return {
        id: g.id,
        name: g.name,
        icon: g.iconURL({ size: 128 }),
        memberCount: g.memberCount,
        hasAdmin: me ? me.permissions.has(PermissionFlagsBits.Administrator) : false,
      };
    });
  }

  /**
   * Get detailed setup status for a specific guild
   */
  public static async getGuildSetupState(guildId: string) {
    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      throw new Error(`Сервер Discord с ID ${guildId} не найден или бот не добавлен на него.`);
    }

    // Load configurations from DB
    const [guildCfg, recruitCfg, academyCfg, voiceCfg, logCfg, botMsgCfg] = await Promise.all([
      prisma.guildConfig.findUnique({ where: { guildId } }),
      prisma.recruitmentConfig.findUnique({ where: { guildId } }),
      prisma.academyConfig.findUnique({ where: { guildId } }),
      prisma.voiceTrackerConfig.findUnique({ where: { guildId } }),
      prisma.loggingConfig.findUnique({ where: { guildId } }),
      prisma.botMessagesConfig.findUnique({ where: { guildId } }),
    ]);

    const channels = guild.channels.cache.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId,
    }));

    return {
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ size: 128 }),
        memberCount: guild.memberCount,
        hasAdmin: guild.members.me?.permissions.has(PermissionFlagsBits.Administrator) ?? false,
      },
      channels,
      bindings: {
        staticBindingChannelId: guildCfg?.staticBindingChannelId || null,
        leaveRequestChannelId: guildCfg?.leaveRequestChannelId || null,
        eventAnnounceChannelId: guildCfg?.defaultEventChannelId || null,
        eventVoiceChannelId: guildCfg?.defaultVoiceChannelId || voiceCfg?.voiceChannelId || null,
        recruitmentApplyChannelId: recruitCfg?.channelId || null,
        recruitmentReviewChannelId: recruitCfg?.categoryId || null,
        academyCategoryId: academyCfg?.categoryId || null,
        academyArchiveCategoryId: academyCfg?.archiveCategoryId || null,
        logsCategoryId: logCfg?.categoryId || null,
        messageLogsChannelId: logCfg?.messageLogsChannelId || null,
        memberLogsChannelId: logCfg?.memberLogsChannelId || null,
        roleLogsChannelId: logCfg?.roleLogsChannelId || null,
        channelLogsChannelId: logCfg?.channelLogsChannelId || null,
        voiceLogsChannelId: logCfg?.voiceLogsChannelId || null,
        inviteLogsChannelId: logCfg?.inviteLogsChannelId || null,
        botLogsChannelId: logCfg?.botLogsChannelId || null,
        eventLogsChannelId: logCfg?.eventLogsChannelId || null,
        welcomeChannelId: botMsgCfg?.welcomeChannelId || null,
        welcomeEnabled: botMsgCfg?.welcomeEnabled ?? false,
      },
    };
  }

  /**
   * One-click provisioning of server structure: categories, channels, permissions, and initial bot panels
   */
  public static async provisionServer(guildId: string, options?: { deployPanels?: boolean }): Promise<ProvisionResult> {
    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      throw new Error(`Бот не подключен к серверу Discord (ID: ${guildId})`);
    }

    const categoriesCreated: string[] = [];
    const channelsCreated: string[] = [];
    const panelsDeployed: string[] = [];

    // Helper: Find or create Category
    const getOrCreateCategory = async (name: string, permissionOverwrites?: any[]): Promise<CategoryChannel> => {
      let cat = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === name.toLowerCase()
      ) as CategoryChannel | undefined;

      if (!cat) {
        cat = await guild.channels.create({
          name,
          type: ChannelType.GuildCategory,
          permissionOverwrites,
        });
        categoriesCreated.push(name);
      }
      return cat;
    };

    // Helper: Find or create TextChannel
    const getOrCreateTextChannel = async (name: string, parentId: string, permissionOverwrites?: any[]): Promise<TextChannel> => {
      let ch = guild.channels.cache.find(
        c => c.type === ChannelType.GuildText && c.parentId === parentId && c.name.toLowerCase() === name.toLowerCase()
      ) as TextChannel | undefined;

      if (!ch) {
        ch = await guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: parentId,
          permissionOverwrites,
        });
        channelsCreated.push(`#${name}`);
      }
      return ch;
    };

    // Helper: Find or create VoiceChannel
    const getOrCreateVoiceChannel = async (name: string, parentId: string): Promise<VoiceChannel> => {
      let vc = guild.channels.cache.find(
        c => c.type === ChannelType.GuildVoice && c.parentId === parentId && c.name.toLowerCase() === name.toLowerCase()
      ) as VoiceChannel | undefined;

      if (!vc) {
        vc = await guild.channels.create({
          name,
          type: ChannelType.GuildVoice,
          parent: parentId,
        });
        channelsCreated.push(`🔊 ${name}`);
      }
      return vc;
    };

    // 1. Category: ИНФОРМАЦИЯ
    const infoCat = await getOrCreateCategory('📋 ИНФОРМАЦИЯ');
    const welcomeChannel = await getOrCreateTextChannel('добро-пожаловать', infoCat.id);
    const staticChannel = await getOrCreateTextChannel('привязка-статика', infoCat.id);
    const leaveChannel = await getOrCreateTextChannel('отпуска-неактив', infoCat.id);

    // 2. Category: НАБОР В СЕМЬЮ (публичный канал подачи и лог)
    const recruitCat = await getOrCreateCategory('📥 НАБОР В СЕМЬЮ');
    const recruitApplyChannel = await getOrCreateTextChannel('подать-заявку', recruitCat.id);
    const botUserId = guild.members.me?.id || guild.client?.user?.id;
    const reviewOverwrites: any[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
    ];
    if (botUserId) {
      reviewOverwrites.push({
        id: botUserId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels],
      });
    }
    const recruitReviewChannel = await getOrCreateTextChannel('заявки-лог', recruitCat.id, reviewOverwrites);

    // 2.1 Dedicated Category for active applicant tickets
    const ticketsCat = await getOrCreateCategory('📨 ЗАЯВКИ В СЕМЬЮ', reviewOverwrites);

    // 3. Category: МЕРОПРИЯТИЯ (МП)
    const eventsCat = await getOrCreateCategory('⚔️ МЕРОПРИЯТИЯ (МП)');
    const eventAnnounceChannel = await getOrCreateTextChannel('сборы-на-мп', eventsCat.id);
    const eventVoiceChannel = await getOrCreateVoiceChannel('Сбор на МП [Ожидание]', eventsCat.id);

    // 4. Categories: ACADEMY & ARCHIVE
    const academyCat = await getOrCreateCategory('🎓 ACADEMY');
    const academyArchiveCat = await getOrCreateCategory('📁 ACADEMY ARCHIVE', [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
    ]);

    // 5. Category: LOGS (All 8 channels via AuditLogger)
    const logSetup = await AuditLogger.setupLogChannels(guild);

    // 6. Save Configuration in Database
    await prisma.guildConfig.upsert({
      where: { guildId: guild.id },
      update: {
        staticBindingChannelId: staticChannel.id,
        leaveRequestChannelId: leaveChannel.id,
        defaultEventChannelId: eventAnnounceChannel.id,
        defaultVoiceChannelId: eventVoiceChannel.id,
      },
      create: {
        guildId: guild.id,
        staticBindingChannelId: staticChannel.id,
        leaveRequestChannelId: leaveChannel.id,
        defaultEventChannelId: eventAnnounceChannel.id,
        defaultVoiceChannelId: eventVoiceChannel.id,
      },
    });

    await prisma.recruitmentConfig.upsert({
      where: { guildId: guild.id },
      update: {
        channelId: recruitApplyChannel.id,
        categoryId: ticketsCat.id,
        logChannelId: recruitReviewChannel.id,
      },
      create: {
        guildId: guild.id,
        channelId: recruitApplyChannel.id,
        categoryId: ticketsCat.id,
        logChannelId: recruitReviewChannel.id,
      },
    });

    await prisma.academyConfig.upsert({
      where: { guildId: guild.id },
      update: {
        categoryId: academyCat.id,
        archiveCategoryId: academyArchiveCat.id,
      },
      create: {
        guildId: guild.id,
        categoryId: academyCat.id,
        archiveCategoryId: academyArchiveCat.id,
      },
    });

    await prisma.voiceTrackerConfig.upsert({
      where: { guildId: guild.id },
      update: {
        voiceChannelId: eventVoiceChannel.id,
        controlChannelId: eventAnnounceChannel.id,
        logChannelId: logSetup.channels.voiceLogsChannelId || logSetup.channels.botLogsChannelId,
      },
      create: {
        guildId: guild.id,
        voiceChannelId: eventVoiceChannel.id,
        controlChannelId: eventAnnounceChannel.id,
        logChannelId: logSetup.channels.voiceLogsChannelId || logSetup.channels.botLogsChannelId,
      },
    });

    await prisma.botMessagesConfig.upsert({
      where: { guildId: guild.id },
      update: {
        welcomeChannelId: welcomeChannel.id,
        welcomeEnabled: true,
      },
      create: {
        guildId: guild.id,
        welcomeChannelId: welcomeChannel.id,
        welcomeEnabled: true,
      },
    });

    // 7. Deploy Interactive Panels & Messages
    if (options?.deployPanels !== false) {
      // Static binding panel
      try {
        await ProfileService.deployStaticBindingPanel(staticChannel);
        panelsDeployed.push('Привязка статика');
      } catch (e: any) {
        console.error('[ServerSetup] Failed to deploy static panel:', e.message);
      }

      // Leave request panel
      try {
        await LeaveService.deployLeavePanel(leaveChannel);
        panelsDeployed.push('Заявки на отпуск');
      } catch (e: any) {
        console.error('[ServerSetup] Failed to deploy leave panel:', e.message);
      }

      // Recruitment apply panel
      try {
        const recruitEmbed = createThemedEmbed({
          color: THEME.COLORS.PRIMARY,
          title: '👋 Путь в семью начинается здесь!',
          description: [
            `> Заявки в семью принимаются на сервере **${guild.name}**. Уведомление о приглашении на обзвон отправляется в созданный тикет.`,
            '',
            '- **Внимательно прочитайте все пункты** при подаче заявки. Если не ответили на все вопросы — **заявка отклоняется**.',
            '- **Срок рассмотрения заявки:** от 1 до 3 дней.',
            '',
            '### Дополнительные правила к подаче заявки:',
            '- Подать заявку можно только при открытом наборе. Если нет доступа к подаче — набор закрыт.',
            '- Откаты с МП / стрельбы должны быть актуальными (при наличии запроса рекрутера).',
            '- Любое нарушение условий или обман в анкете — **отказ и внесение в ЧС**.',
            '',
            '-# Нажмите на кнопку ниже, чтобы открыть форму анкеты.',
          ].join('\n'),
          thumbnailUrl: guild.iconURL({ size: 256 }),
          footerText: `${guild.name} • Набор в семью`,
        });

        const recruitRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('recruit_apply_button')
            .setLabel('Подать заявку')
            .setStyle(ButtonStyle.Primary)
        );

        await recruitApplyChannel.send({ embeds: [recruitEmbed], components: [recruitRow] });
        panelsDeployed.push('Анкета набора');
      } catch (e: any) {
        console.error('[ServerSetup] Failed to deploy recruit panel:', e.message);
      }

      // Welcome channel info embed
      try {
        const welcomeEmbed = createThemedEmbed({
          color: THEME.COLORS.PRIMARY,
          title: `Сервер семьи ${guild.name} • Информация`,
          description: [
            `> Добро пожаловать в сообщество семьи **${guild.name}** на Majestic RP.`,
            '',
            '### Навигация и автоматизация:',
            `- <#${staticChannel.id}> — Обязательная привязка Majestic Static ID`,
            `- <#${leaveChannel.id}> — Оформление отпуска / неактива (до 14 дней)`,
            `- <#${recruitApplyChannel.id}> — Электронная подача заявки в семью`,
            `- <#${eventAnnounceChannel.id}> — Сборы на семейные мероприятия (МП)`,
            '',
            '-# INTERPOL • Информационный портал',
          ].join('\n'),
          thumbnailUrl: guild.iconURL({ size: 256 }),
          footerText: `${guild.name} • Информационный портал`,
        });

        await welcomeChannel.send({ embeds: [welcomeEmbed] });
        panelsDeployed.push('Информационное приветствие');
      } catch (e: any) {
        console.error('[ServerSetup] Failed to deploy welcome embed:', e.message);
      }
    }

    return {
      guildId: guild.id,
      guildName: guild.name,
      categoriesCreated,
      channelsCreated,
      panelsDeployed,
      channels: {
        welcomeChannelId: welcomeChannel.id,
        staticBindingChannelId: staticChannel.id,
        leaveRequestChannelId: leaveChannel.id,
        recruitmentApplyChannelId: recruitApplyChannel.id,
        recruitmentReviewChannelId: recruitReviewChannel.id,
        eventAnnounceChannelId: eventAnnounceChannel.id,
        voiceChannelId: eventVoiceChannel.id,
        academyCategoryId: academyCat.id,
        academyArchiveCategoryId: academyArchiveCat.id,
        logsCategoryId: logSetup.categoryId,
      },
    };
  }

  /**
   * Deploy or re-deploy a specific panel to a target channel
   */
  public static async deployPanel(
    guildId: string, 
    panelType: 'static' | 'leave' | 'recruit' | 'welcome' | 'logs' | 'voice-tracker', 
    channelId?: string
  ) {
    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      throw new Error(`Бот не подключен к серверу Discord (ID: ${guildId})`);
    }

    if (panelType === 'logs') {
      return await AuditLogger.setupLogChannels(guild);
    }

    if (!channelId) {
      throw new Error('Укажите ID текстового канала для отправки');
    }

    const channel = (guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
    if (!channel || !channel.isTextBased()) {
      throw new Error('Текстовый канал не найден на сервере');
    }

    switch (panelType) {
      case 'static': {
        const msg = await ProfileService.deployStaticBindingPanel(channel);
        await prisma.guildConfig.upsert({
          where: { guildId },
          update: { staticBindingChannelId: channel.id },
          create: { guildId, staticBindingChannelId: channel.id },
        });
        return { success: true, messageId: msg.id, channelId: channel.id };
      }
      case 'leave': {
        const msg = await LeaveService.deployLeavePanel(channel);
        await prisma.guildConfig.upsert({
          where: { guildId },
          update: { leaveRequestChannelId: channel.id },
          create: { guildId, leaveRequestChannelId: channel.id },
        });
        return { success: true, messageId: msg.id, channelId: channel.id };
      }
      case 'recruit': {
        const recruitEmbed = createThemedEmbed({
          color: THEME.COLORS.PRIMARY,
          title: '👋 Путь в семью начинается здесь!',
          description: [
            `> Заявки в семью принимаются на сервере **${guild.name}**. Уведомление о приглашении на обзвон отправляется в созданный тикет.`,
            '',
            '- **Внимательно прочитайте все пункты** при подаче заявки. Если не ответили на все вопросы — **заявка отклоняется**.',
            '- **Срок рассмотрения заявки:** от 1 до 3 дней.',
            '',
            '### Дополнительные правила к подаче заявки:',
            '- Подать заявку можно только при открытом наборе. Если нет доступа к подаче — набор закрыт.',
            '- Откаты с МП / стрельбы должны быть актуальными (при наличии запроса рекрутера).',
            '- Любое нарушение условий или обман в анкете — **отказ и внесение в ЧС**.',
            '',
            '-# Нажмите на кнопку ниже, чтобы открыть форму анкеты.',
          ].join('\n'),
          thumbnailUrl: guild.iconURL({ size: 256 }),
          footerText: `${guild.name} • Набор в семью`,
        });

        const recruitRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('recruit_apply_button')
            .setLabel('Подать заявку')
            .setStyle(ButtonStyle.Primary)
        );

        const msg = await channel.send({ embeds: [recruitEmbed], components: [recruitRow] });
        await prisma.recruitmentConfig.upsert({
          where: { guildId },
          update: { channelId: channel.id },
          create: { guildId, channelId: channel.id },
        });
        return { success: true, messageId: msg.id, channelId: channel.id };
      }
      case 'welcome': {
        const welcomeEmbed = new EmbedBuilder()
          .setColor(0xEC4899)
          .setTitle(`👑 Сервер семьи ${guild.name} | Majestic RP`)
          .setDescription(
            `Добро пожаловать в Discord-сообщество семьи **${guild.name}**!\n\n` +
            `Ознакомьтесь с правилами семьи и подайте заявку или привяжите свой статик для участия в сборах.`
          )
          .setThumbnail(guild.iconURL({ size: 256 }))
          .setFooter({ text: `${guild.name} • Информационный портал` })
          .setTimestamp();

        const msg = await channel.send({ embeds: [welcomeEmbed] });
        return { success: true, messageId: msg.id, channelId: channel.id };
      }
      default:
        throw new Error(`Неизвестный тип панели: ${panelType}`);
    }
  }

  /**
   * Save custom channel / category bindings for the guild
   */
  public static async updateBindings(guildId: string, bindings: {
    staticBindingChannelId?: string;
    leaveRequestChannelId?: string;
    eventAnnounceChannelId?: string;
    eventVoiceChannelId?: string;
    recruitmentApplyChannelId?: string;
    recruitmentReviewChannelId?: string;
    academyCategoryId?: string;
    academyArchiveCategoryId?: string;
    welcomeChannelId?: string;
    welcomeEnabled?: boolean;
  }) {
    if (
      bindings.staticBindingChannelId !== undefined ||
      bindings.leaveRequestChannelId !== undefined ||
      bindings.eventAnnounceChannelId !== undefined ||
      bindings.eventVoiceChannelId !== undefined
    ) {
      await prisma.guildConfig.upsert({
        where: { guildId },
        update: {
          ...(bindings.staticBindingChannelId !== undefined && { staticBindingChannelId: bindings.staticBindingChannelId }),
          ...(bindings.leaveRequestChannelId !== undefined && { leaveRequestChannelId: bindings.leaveRequestChannelId }),
          ...(bindings.eventAnnounceChannelId !== undefined && { defaultEventChannelId: bindings.eventAnnounceChannelId }),
          ...(bindings.eventVoiceChannelId !== undefined && { defaultVoiceChannelId: bindings.eventVoiceChannelId }),
        },
        create: {
          guildId,
          staticBindingChannelId: bindings.staticBindingChannelId || null,
          leaveRequestChannelId: bindings.leaveRequestChannelId || null,
          defaultEventChannelId: bindings.eventAnnounceChannelId || null,
          defaultVoiceChannelId: bindings.eventVoiceChannelId || null,
        },
      });
    }

    if (bindings.recruitmentApplyChannelId !== undefined || bindings.recruitmentReviewChannelId !== undefined) {
      await prisma.recruitmentConfig.upsert({
        where: { guildId },
        update: {
          ...(bindings.recruitmentApplyChannelId !== undefined && { channelId: bindings.recruitmentApplyChannelId }),
          ...(bindings.recruitmentReviewChannelId !== undefined && { categoryId: bindings.recruitmentReviewChannelId }),
        },
        create: {
          guildId,
          channelId: bindings.recruitmentApplyChannelId || null,
          categoryId: bindings.recruitmentReviewChannelId || null,
        },
      });
    }

    if (bindings.academyCategoryId !== undefined || bindings.academyArchiveCategoryId !== undefined) {
      await prisma.academyConfig.upsert({
        where: { guildId },
        update: {
          ...(bindings.academyCategoryId !== undefined && { categoryId: bindings.academyCategoryId }),
          ...(bindings.academyArchiveCategoryId !== undefined && { archiveCategoryId: bindings.academyArchiveCategoryId }),
        },
        create: {
          guildId,
          categoryId: bindings.academyCategoryId || null,
          archiveCategoryId: bindings.academyArchiveCategoryId || null,
        },
      });
    }

    if (bindings.eventVoiceChannelId !== undefined) {
      await prisma.voiceTrackerConfig.upsert({
        where: { guildId },
        update: { voiceChannelId: bindings.eventVoiceChannelId },
        create: { guildId, voiceChannelId: bindings.eventVoiceChannelId },
      });
    }

    if (bindings.welcomeChannelId !== undefined || bindings.welcomeEnabled !== undefined) {
      await prisma.botMessagesConfig.upsert({
        where: { guildId },
        update: {
          ...(bindings.welcomeChannelId !== undefined && { welcomeChannelId: bindings.welcomeChannelId || null }),
          ...(bindings.welcomeEnabled !== undefined && { welcomeEnabled: Boolean(bindings.welcomeEnabled) }),
        },
        create: {
          guildId,
          welcomeChannelId: bindings.welcomeChannelId || null,
          welcomeEnabled: Boolean(bindings.welcomeEnabled),
        },
      });
    }

    return { success: true };
  }
}
