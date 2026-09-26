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
import { TierService } from '../tier/tierService';
import { THEME, createThemedEmbed } from '../../utils/theme';
import { BotMessageManager } from '../../utils/botMessageManager';

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
    const [guildCfg, recruitCfg, academyCfg, logCfg, botMsgCfg, tierCfg] = await Promise.all([
      prisma.guildConfig.findUnique({ where: { guildId } }),
      prisma.recruitmentConfig.findUnique({ where: { guildId } }),
      prisma.academyConfig.findUnique({ where: { guildId } }),
      prisma.loggingConfig.findUnique({ where: { guildId } }),
      prisma.botMessagesConfig.findUnique({ where: { guildId } }),
      prisma.tierConfig.findUnique({ where: { guildId } }),
    ]);

    const channels = guild.channels.cache.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId,
    }));

    const roles = guild.roles.cache
      .filter(r => r.name !== '@everyone')
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
      }));

    const me = guild.members.me;
    const botPermissions = {
      hasAdministrator: me?.permissions.has(PermissionFlagsBits.Administrator) ?? false,
      manageRoles: me?.permissions.has(PermissionFlagsBits.ManageRoles) ?? false,
      manageChannels: me?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false,
      sendMessages: me?.permissions.has(PermissionFlagsBits.SendMessages) ?? false,
      embedLinks: me?.permissions.has(PermissionFlagsBits.EmbedLinks) ?? false,
      manageNicknames: me?.permissions.has(PermissionFlagsBits.ManageNicknames) ?? false,
      botHighestRoleName: me?.roles.highest.name || 'Bot',
      botRolePosition: me?.roles.highest.position || 0,
    };

    let recruiterRoles: string[] = [];
    if (recruitCfg?.recruiterRoleIds) {
      try {
        recruiterRoles = JSON.parse(recruitCfg.recruiterRoleIds);
      } catch {
        recruiterRoles = [];
      }
    }

    const roleBindings = {
      recruiterRoleId: recruiterRoles[0] || null,
      recruitApprovedRoleId: recruitCfg?.memberRoleId || null,
      academicRoleId: academyCfg?.academicRoleId || null,
      promotedRoleId: academyCfg?.promotedRoleId || null,
      tierCheckerRoleId: tierCfg?.checkerRoleId || null,
      eventPriorityRoleId: guildCfg?.eventPriorityRoleId || null,
    };

    return {
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ size: 128 }),
        memberCount: guild.memberCount,
        hasAdmin: botPermissions.hasAdministrator,
      },
      botPermissions,
      channels,
      roles,
      roleBindings,
      bindings: {
        staticBindingChannelId: guildCfg?.staticBindingChannelId || null,
        leaveRequestChannelId: guildCfg?.leaveRequestChannelId || null,
        eventAnnounceChannelId: guildCfg?.defaultEventChannelId || null,
        eventVoiceChannelId: guildCfg?.defaultVoiceChannelId || null,
        recruitmentApplyChannelId: recruitCfg?.channelId || null,
        recruitmentReviewChannelId: recruitCfg?.categoryId || null,
        academyCategoryId: academyCfg?.categoryId || null,
        academyArchiveCategoryId: academyCfg?.archiveCategoryId || null,
        tierCategoryId: tierCfg?.categoryId || null,
        tierApplyChannelId: tierCfg?.applyChannelId || null,
        tierReviewChannelId: tierCfg?.reviewChannelId || null,
        tierCheckerRoleId: tierCfg?.checkerRoleId || null,
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
        const recruitRendered = await BotMessageManager.renderMessage(guild.id, 'recruitment_announcement', {
          guild: guild.name,
          memberCount: guild.memberCount,
        });

        const recruitRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('recruit_apply_button')
            .setLabel('Подать заявку')
            .setStyle(ButtonStyle.Primary)
        );

        await recruitApplyChannel.send({
          content: recruitRendered.content,
          embeds: [recruitRendered.embed],
          components: [recruitRow],
        });
        panelsDeployed.push('Анкета набора');
      } catch (e: any) {
        console.error('[ServerSetup] Failed to deploy recruit panel:', e.message);
      }

      // Welcome channel info embed
      try {
        const welcomeRendered = await BotMessageManager.renderMessage(guild.id, 'welcome_channel_info', {
          guild: guild.name,
          memberCount: guild.memberCount,
        });

        await welcomeChannel.send({
          content: welcomeRendered.content,
          embeds: [welcomeRendered.embed],
        });
        panelsDeployed.push('Информационное приветствие');
      } catch (e: any) {
        console.error('[ServerSetup] Failed to deploy welcome embed:', e.message);
      }

      // Tier structure & apply panel
      try {
        await TierService.setupTierStructure(guild);
        categoriesCreated.push('🎯 ЗАЯВКИ НА ТИР');
        channelsCreated.push('#заявки-на-тир', '#проверка-тир');
        panelsDeployed.push('Тир система: #заявки-на-тир');
      } catch (e: any) {
        console.error('[ServerSetup] Failed to deploy tier panel:', e.message);
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
    panelType: 'static' | 'leave' | 'recruit' | 'welcome' | 'logs' | 'voice-tracker' | 'tier', 
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
        const rendered = await BotMessageManager.renderMessage(guildId, 'recruitment_announcement', {
          guild: guild.name,
          memberCount: guild.memberCount,
        });

        const recruitRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('recruit_apply_button')
            .setLabel('Подать заявку')
            .setStyle(ButtonStyle.Primary)
        );

        const msg = await channel.send({
          content: rendered.content,
          embeds: [rendered.embed],
          components: [recruitRow],
        });
        await prisma.recruitmentConfig.upsert({
          where: { guildId },
          update: { channelId: channel.id },
          create: { guildId, channelId: channel.id },
        });
        return { success: true, messageId: msg.id, channelId: channel.id };
      }
      case 'welcome': {
        const rendered = await BotMessageManager.renderMessage(guildId, 'welcome_channel_info', {
          guild: guild.name,
          memberCount: guild.memberCount,
        });

        const msg = await channel.send({
          content: rendered.content,
          embeds: [rendered.embed],
        });
        return { success: true, messageId: msg.id, channelId: channel.id };
      }
      case 'tier': {
        const msgId = await TierService.deployApplyPanel(channel, guild);
        await prisma.tierConfig.upsert({
          where: { guildId },
          update: { applyChannelId: channel.id },
          create: { guildId, applyChannelId: channel.id, enabled: true },
        });
        return { success: true, messageId: msgId, channelId: channel.id };
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
    tierCategoryId?: string;
    tierApplyChannelId?: string;
    tierReviewChannelId?: string;
    tierCheckerRoleId?: string;
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

    if (
      bindings.tierCategoryId !== undefined ||
      bindings.tierApplyChannelId !== undefined ||
      bindings.tierReviewChannelId !== undefined ||
      bindings.tierCheckerRoleId !== undefined
    ) {
      await prisma.tierConfig.upsert({
        where: { guildId },
        update: {
          ...(bindings.tierCategoryId !== undefined && { categoryId: bindings.tierCategoryId || null }),
          ...(bindings.tierApplyChannelId !== undefined && { applyChannelId: bindings.tierApplyChannelId || null }),
          ...(bindings.tierReviewChannelId !== undefined && { reviewChannelId: bindings.tierReviewChannelId || null }),
          ...(bindings.tierCheckerRoleId !== undefined && { checkerRoleId: bindings.tierCheckerRoleId || null }),
        },
        create: {
          guildId,
          categoryId: bindings.tierCategoryId || null,
          applyChannelId: bindings.tierApplyChannelId || null,
          reviewChannelId: bindings.tierReviewChannelId || null,
          checkerRoleId: bindings.tierCheckerRoleId || null,
          enabled: true,
        },
      });
    }

    return { success: true };
  }

  /**
   * Create a new role in Discord server
   */
  public static async createRole(guildId: string, roleData: { name: string; color?: number | string; hoist?: boolean }) {
    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) throw new Error(`Сервер Discord ${guildId} не найден`);

    let colorNum: number | undefined = undefined;
    if (typeof roleData.color === 'string') {
      const hex = roleData.color.replace('#', '');
      colorNum = parseInt(hex, 16);
    } else if (typeof roleData.color === 'number') {
      colorNum = roleData.color;
    }

    const created = await guild.roles.create({
      name: roleData.name,
      color: colorNum,
      hoist: roleData.hoist !== false,
      reason: 'INTERPOL BOT • Первоначальная настройка ролей сервера',
    });

    return {
      id: created.id,
      name: created.name,
      color: created.color,
    };
  }

  /**
   * Create a new channel or category in Discord server
   */
  public static async createChannel(guildId: string, channelData: { name: string; type: number; parentId?: string; topic?: string }) {
    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) throw new Error(`Сервер Discord ${guildId} не найден`);

    const created: any = await guild.channels.create({
      name: channelData.name,
      type: channelData.type,
      parent: channelData.parentId || undefined,
      topic: channelData.topic,
      reason: 'INTERPOL BOT • Первоначальная настройка каналов сервера',
    });

    return {
      id: created.id,
      name: created.name,
      type: created.type,
      parentId: created.parentId,
    };
  }

  /**
   * Update role bindings (Recruiter, Academy 1 rank, Promotion 2 rank, Tier checker, Event priority)
   */
  public static async updateRoleBindings(guildId: string, roleBindings: any) {
    if (roleBindings.recruiterRoleId !== undefined || roleBindings.recruitApprovedRoleId !== undefined) {
      const recruiterRoles = roleBindings.recruiterRoleId ? [roleBindings.recruiterRoleId] : [];
      await prisma.recruitmentConfig.upsert({
        where: { guildId },
        update: {
          ...(roleBindings.recruiterRoleId !== undefined && { recruiterRoleIds: JSON.stringify(recruiterRoles) }),
          ...(roleBindings.recruitApprovedRoleId !== undefined && { memberRoleId: roleBindings.recruitApprovedRoleId || null }),
        },
        create: {
          guildId,
          recruiterRoleIds: JSON.stringify(recruiterRoles),
          memberRoleId: roleBindings.recruitApprovedRoleId || null,
        },
      });
    }

    if (roleBindings.academicRoleId !== undefined || roleBindings.promotedRoleId !== undefined) {
      await prisma.academyConfig.upsert({
        where: { guildId },
        update: {
          ...(roleBindings.academicRoleId !== undefined && { academicRoleId: roleBindings.academicRoleId || null }),
          ...(roleBindings.promotedRoleId !== undefined && { promotedRoleId: roleBindings.promotedRoleId || null }),
        },
        create: {
          guildId,
          academicRoleId: roleBindings.academicRoleId || null,
          promotedRoleId: roleBindings.promotedRoleId || null,
        },
      });
    }

    if (roleBindings.tierCheckerRoleId !== undefined) {
      await prisma.tierConfig.upsert({
        where: { guildId },
        update: {
          checkerRoleId: roleBindings.tierCheckerRoleId || null,
        },
        create: {
          guildId,
          checkerRoleId: roleBindings.tierCheckerRoleId || null,
          enabled: true,
        },
      });
    }

    if (roleBindings.eventPriorityRoleId !== undefined) {
      await prisma.guildConfig.upsert({
        where: { guildId },
        update: {
          eventPriorityRoleId: roleBindings.eventPriorityRoleId || null,
        },
        create: {
          guildId,
          eventPriorityRoleId: roleBindings.eventPriorityRoleId || null,
        },
      });
    }

    return { success: true };
  }

  /**
   * Auto-detect existing channels and roles on the server by keywords
   */
  public static async autoDetectBindings(guildId: string) {
    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) throw new Error(`Сервер Discord ${guildId} не найден`);

    const channels = Array.from(guild.channels.cache.values());
    const roles = Array.from(guild.roles.cache.values()).filter(r => r.name !== '@everyone');

    // 1. Match Roles
    const detectedRoles: any = {};
    for (const r of roles) {
      const lower = r.name.toLowerCase();
      if (!detectedRoles.recruiterRoleId && lower.includes('рекрут')) {
        detectedRoles.recruiterRoleId = r.id;
      }
      if (!detectedRoles.academicRoleId && (lower.includes('академ') || lower.includes('курсант') || lower.includes('1 ранг'))) {
        detectedRoles.academicRoleId = r.id;
      }
      if (!detectedRoles.promotedRoleId && (lower.includes('основн') || lower.includes('участник') || lower.includes('состав') || lower.includes('2 ранг'))) {
        detectedRoles.promotedRoleId = r.id;
      }
      if (!detectedRoles.tierCheckerRoleId && (lower.includes('тир') || lower.includes('стрелок') || lower.includes('проверяющ'))) {
        detectedRoles.tierCheckerRoleId = r.id;
      }
      if (!detectedRoles.eventPriorityRoleId && (lower.includes('капт') || lower.includes('приоритет') || lower.includes('бизвар'))) {
        detectedRoles.eventPriorityRoleId = r.id;
      }
    }

    // 2. Match Channels & Categories
    const detectedBindings: any = {};
    for (const c of channels) {
      const lower = c.name.toLowerCase();
      const isCat = c.type === ChannelType.GuildCategory;
      const isText = c.type === ChannelType.GuildText;

      if (isText) {
        if (!detectedBindings.staticBindingChannelId && (lower.includes('статик') || lower.includes('привязк'))) {
          detectedBindings.staticBindingChannelId = c.id;
        }
        if (!detectedBindings.leaveRequestChannelId && (lower.includes('отпуск') || lower.includes('отгул'))) {
          detectedBindings.leaveRequestChannelId = c.id;
        }
        if (!detectedBindings.recruitmentApplyChannelId && (lower.includes('заявк') || lower.includes('набор') || lower.includes('анкет'))) {
          detectedBindings.recruitmentApplyChannelId = c.id;
        }
        if (!detectedBindings.tierApplyChannelId && (lower.includes('тир') || lower.includes('стрельб'))) {
          detectedBindings.tierApplyChannelId = c.id;
        }
        if (!detectedBindings.eventAnnounceChannelId && (lower.includes('сбор') || lower.includes('мероприят') || lower.includes('мп'))) {
          detectedBindings.eventAnnounceChannelId = c.id;
        }
        if (!detectedBindings.welcomeChannelId && (lower.includes('приветств') || lower.includes('добро-пожаловать') || lower.includes('welcome'))) {
          detectedBindings.welcomeChannelId = c.id;
        }
        // Logs
        if (!detectedBindings.messageLogsChannelId && lower.includes('сообщен')) detectedBindings.messageLogsChannelId = c.id;
        if (!detectedBindings.memberLogsChannelId && (lower.includes('участник') || lower.includes('вход') || lower.includes('выход'))) detectedBindings.memberLogsChannelId = c.id;
        if (!detectedBindings.roleLogsChannelId && lower.includes('рол')) detectedBindings.roleLogsChannelId = c.id;
        if (!detectedBindings.channelLogsChannelId && lower.includes('канал')) detectedBindings.channelLogsChannelId = c.id;
        if (!detectedBindings.voiceLogsChannelId && (lower.includes('войс') || lower.includes('голос'))) detectedBindings.voiceLogsChannelId = c.id;
        if (!detectedBindings.inviteLogsChannelId && (lower.includes('инвайт') || lower.includes('приглаш'))) detectedBindings.inviteLogsChannelId = c.id;
        if (!detectedBindings.botLogsChannelId && lower.includes('бот')) detectedBindings.botLogsChannelId = c.id;
        if (!detectedBindings.eventLogsChannelId && (lower.includes('мероприят') || lower.includes('мп-лог'))) detectedBindings.eventLogsChannelId = c.id;
      }

      if (isCat) {
        if (!detectedBindings.recruitmentReviewChannelId && (lower.includes('тикет') || lower.includes('заявк') || lower.includes('набор'))) {
          detectedBindings.recruitmentReviewChannelId = c.id;
        }
        if (!detectedBindings.academyCategoryId && (lower.includes('академ') && !lower.includes('архив'))) {
          detectedBindings.academyCategoryId = c.id;
        }
        if (!detectedBindings.academyArchiveCategoryId && lower.includes('архив')) {
          detectedBindings.academyArchiveCategoryId = c.id;
        }
        if (!detectedBindings.tierCategoryId && lower.includes('тир')) {
          detectedBindings.tierCategoryId = c.id;
        }
      }
    }

    // Save detected bindings
    if (Object.keys(detectedBindings).length > 0) {
      await this.updateBindings(guildId, detectedBindings);
    }
    if (Object.keys(detectedRoles).length > 0) {
      await this.updateRoleBindings(guildId, detectedRoles);
    }

    return {
      detectedRoles,
      detectedBindings,
      rolesCount: Object.keys(detectedRoles).length,
      channelsCount: Object.keys(detectedBindings).length,
    };
  }
}
