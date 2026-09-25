import { Router, Response } from 'express';
import { ChannelType, PermissionFlagsBits, TextChannel, CategoryChannel } from 'discord.js';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { getDiscordGuild, resolveGuildId } from '../utils/guild';
import { AuditLogger } from '../../bot/modules/logging/auditLogger';
import { ServerSetupService } from '../../bot/modules/setup/serverSetupService';

export const testModeRouter = Router();

testModeRouter.use(requireAuth);

// Ensure user has admin or isBypass
testModeRouter.use((req: AuthenticatedRequest, res: Response, next) => {
  if (req.user?.isBypass || req.user?.permissions?.isAdmin) {
    return next();
  }
  return res.status(403).json({ error: 'Доступ разрешен только в тестовом режиме или администраторам' });
});

/**
 * POST /api/test-mode/deploy-all
 * 1-Click quick deployment of all server categories, channels, and panel buttons
 */
testModeRouter.post('/deploy-all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(400).json({ error: 'Сервер Discord не подключен' });

    const results: string[] = [];

    // 1. Setup logging category & channels
    try {
      const logsResult = await AuditLogger.setupLogChannels(guild);
      results.push(`Категория LOGS и каналы логирования созданы (${Object.keys(logsResult.channels).length} каналов)`);
    } catch (e: any) {
      results.push(`Ошибка создания логов: ${e.message}`);
    }

    // 2. Setup server channels (Recruitment, Academy, Events, Panels)
    try {
      const setupResult = await ServerSetupService.provisionServer(guild.id, { deployPanels: true });
      results.push(`Категории и каналы семьи развернуты (${setupResult.channelsCreated.length} каналов)`);
    } catch (e: any) {
      results.push(`Ошибка настройки сервера: ${e.message}`);
    }

    await AuditLogger.recordEntry({
      guildId,
      action: 'TEST_MODE_DEPLOY_ALL',
      category: 'BOT',
      title: 'Быстрое развертывание',
      description: 'Выполнено быстрое развертывание всех каналов и категорий бота',
      executorId: req.user!.userId,
      executorTag: req.user!.username,
    }).catch(() => null);

    return res.json({ success: true, results });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/test-mode/purge-messages
 * Purge messages from a single Discord channel
 */
testModeRouter.post('/purge-messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const { channelId, amount = 50 } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Укажите ID канала' });

    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(400).json({ error: 'Сервер Discord не подключен' });

    const channel = (guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Канал не найден или не является текстовым' });
    }

    const count = Math.min(100, Math.max(1, parseInt(amount, 10) || 50));
    const deleted = await channel.bulkDelete(count, true).catch(async () => {
      // If messages are older than 14 days, fetch and delete manually
      const messages = await channel.messages.fetch({ limit: count }).catch(() => null);
      let deletedCount = 0;
      if (messages) {
        for (const msg of messages.values()) {
          await msg.delete().catch(() => null);
          deletedCount++;
        }
      }
      return { size: deletedCount };
    });

    await AuditLogger.recordEntry({
      guildId,
      action: 'TEST_MODE_PURGE_MESSAGES',
      category: 'BOT',
      title: 'Очистка сообщений',
      description: `Очищено сообщений: ${(deleted as any)?.size || count} в #${channel.name}`,
      executorId: req.user!.userId,
      executorTag: req.user!.username,
      targetId: channelId,
      targetTag: channel.name,
    }).catch(() => null);

    return res.json({ success: true, deletedCount: (deleted as any)?.size || count });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/test-mode/purge-all-bot-messages
 * Purge ALL messages sent by the bot across all Discord channels
 */
testModeRouter.post('/purge-all-bot-messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(400).json({ error: 'Сервер Discord не подключен' });

    const botUserId = bot.user?.id;
    if (!botUserId) return res.status(400).json({ error: 'Бот не инициализирован в Discord' });

    await guild.channels.fetch().catch(() => null);

    const me = guild.members.me;
    const textChannels = guild.channels.cache.filter((c): c is TextChannel => {
      if (!c || !c.isTextBased() || c.isDMBased()) return false;
      if (!me) return true;
      const perms = c.permissionsFor(me);
      return Boolean(perms?.has(PermissionFlagsBits.ViewChannel) && perms?.has(PermissionFlagsBits.ReadMessageHistory));
    });

    let totalDeleted = 0;
    let channelsProcessed = 0;
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

    for (const channel of textChannels.values()) {
      try {
        channelsProcessed++;
        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (!messages || messages.size === 0) continue;

        const botMessages = messages.filter(m => m.author.id === botUserId);
        if (botMessages.size === 0) continue;

        const bulkDeletable = botMessages.filter(m => m.createdTimestamp > fourteenDaysAgo);
        const olderMessages = botMessages.filter(m => m.createdTimestamp <= fourteenDaysAgo);

        if (bulkDeletable.size > 0) {
          if (bulkDeletable.size === 1) {
            await bulkDeletable.first()?.delete().catch(() => null);
            totalDeleted += 1;
          } else {
            const resBulk = await channel.bulkDelete(bulkDeletable, true).catch(() => null);
            totalDeleted += resBulk ? resBulk.size : bulkDeletable.size;
          }
        }

        for (const oldMsg of olderMessages.values()) {
          await oldMsg.delete().catch(() => null);
          totalDeleted += 1;
          await new Promise(r => setTimeout(r, 40));
        }
      } catch (chErr) {
        console.warn(`[PurgeAllBotMessages] Error in #${channel.name}:`, chErr);
      }
    }

    await AuditLogger.recordEntry({
      guildId,
      action: 'TEST_MODE_PURGE_ALL_BOT_MESSAGES',
      category: 'BOT',
      title: 'Массовое удаление всех сообщений бота',
      description: `Удалено ${totalDeleted} сообщений бота в ${channelsProcessed} каналах`,
      executorId: req.user!.userId,
      executorTag: req.user!.username,
    }).catch(() => null);

    return res.json({ success: true, deletedCount: totalDeleted, channelsProcessed });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/test-mode/purge-all-bot-channels
 * Purge ALL channels and categories created by the bot
 */
testModeRouter.post('/purge-all-bot-channels', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(400).json({ error: 'Сервер Discord не подключен' });

    await guild.channels.fetch().catch(() => null);

    // 1. Collect configured channel/category IDs from DB
    const [logCfg, academyCfg, recruitCfg, voiceCfg, guildCfg, academyChannels, applications] = await Promise.all([
      prisma.loggingConfig.findUnique({ where: { guildId } }),
      prisma.academyConfig.findUnique({ where: { guildId } }),
      prisma.recruitmentConfig.findUnique({ where: { guildId } }),
      prisma.voiceTrackerConfig.findUnique({ where: { guildId } }),
      prisma.guildConfig.findUnique({ where: { guildId } }),
      prisma.academyChannel.findMany({ where: { guildId }, select: { channelId: true } }),
      prisma.recruitmentApplication.findMany({ where: { guildId }, select: { channelId: true } }),
    ]);

    const targetChannelIds = new Set<string>();

    if (logCfg) {
      if (logCfg.categoryId) targetChannelIds.add(logCfg.categoryId);
      if (logCfg.messageLogsChannelId) targetChannelIds.add(logCfg.messageLogsChannelId);
      if (logCfg.memberLogsChannelId) targetChannelIds.add(logCfg.memberLogsChannelId);
      if (logCfg.roleLogsChannelId) targetChannelIds.add(logCfg.roleLogsChannelId);
      if (logCfg.channelLogsChannelId) targetChannelIds.add(logCfg.channelLogsChannelId);
      if (logCfg.voiceLogsChannelId) targetChannelIds.add(logCfg.voiceLogsChannelId);
      if (logCfg.inviteLogsChannelId) targetChannelIds.add(logCfg.inviteLogsChannelId);
      if (logCfg.botLogsChannelId) targetChannelIds.add(logCfg.botLogsChannelId);
      if (logCfg.eventLogsChannelId) targetChannelIds.add(logCfg.eventLogsChannelId);
    }

    if (academyCfg) {
      if (academyCfg.categoryId) targetChannelIds.add(academyCfg.categoryId);
      if (academyCfg.archiveCategoryId) targetChannelIds.add(academyCfg.archiveCategoryId);
    }
    for (const ac of academyChannels) {
      if (ac.channelId) targetChannelIds.add(ac.channelId);
    }

    if (recruitCfg) {
      if (recruitCfg.categoryId) targetChannelIds.add(recruitCfg.categoryId);
      if (recruitCfg.channelId) targetChannelIds.add(recruitCfg.channelId);
      if (recruitCfg.logChannelId) targetChannelIds.add(recruitCfg.logChannelId);
    }
    for (const app of applications) {
      if (app.channelId) targetChannelIds.add(app.channelId);
    }

    if (voiceCfg) {
      if (voiceCfg.controlChannelId) targetChannelIds.add(voiceCfg.controlChannelId);
      if (voiceCfg.logChannelId) targetChannelIds.add(voiceCfg.logChannelId);
    }

    if (guildCfg) {
      if (guildCfg.leaveRequestChannelId) targetChannelIds.add(guildCfg.leaveRequestChannelId);
      if (guildCfg.staticBindingChannelId) targetChannelIds.add(guildCfg.staticBindingChannelId);
      if (guildCfg.defaultEventChannelId) targetChannelIds.add(guildCfg.defaultEventChannelId);
      if (guildCfg.defaultVoiceChannelId) targetChannelIds.add(guildCfg.defaultVoiceChannelId);
    }

    // 2. Identify channels/categories by name patterns
    const botCategoryNames = [
      'logs',
      '📋 логирование',
      '🎓 academy',
      '🎓 академия семьи',
      '🎓 академия',
      '📁 academy archive',
      '📦 архив академии',
      '📥 набор в семью',
      '📝 набор в семью',
      '⚔️ мероприятия (мп)',
      '🏆 мероприятия семьи',
      '📋 информация',
      '👑 семейный отдел',
      '🔊 голосовой трекер',
    ];

    const botCategories = guild.channels.cache.filter((c): c is CategoryChannel => {
      if (c.type !== ChannelType.GuildCategory) return false;
      const lower = c.name.toLowerCase();
      return targetChannelIds.has(c.id) || botCategoryNames.some(name => lower.includes(name));
    });

    const categoryIds = new Set<string>([...botCategories.map(c => c.id)]);

    // Find all channels inside these categories or matching name prefixes
    const channelsToDelete: any[] = [];
    const categoriesToDelete: CategoryChannel[] = [...botCategories.values()];

    for (const ch of guild.channels.cache.values()) {
      if (ch.type === ChannelType.GuildCategory) continue;

      const lowerName = ch.name.toLowerCase();
      const isInsideBotCat = ch.parentId ? categoryIds.has(ch.parentId) : false;
      const matchesPrefix = 
        lowerName.startsWith('академик-') ||
        lowerName.startsWith('акад-') ||
        lowerName.startsWith('тикет-') ||
        lowerName.startsWith('ticket-') ||
        lowerName.startsWith('заявка-') ||
        lowerName.startsWith('отпуск-');

      if (targetChannelIds.has(ch.id) || isInsideBotCat || matchesPrefix) {
        channelsToDelete.push(ch);
      }
    }

    let deletedChannelsCount = 0;
    for (const ch of channelsToDelete) {
      try {
        await ch.delete('Очистка структуры бота в тестовом режиме');
        deletedChannelsCount++;
      } catch (e) {
        // Ignored if already deleted
      }
    }

    let deletedCategoriesCount = 0;
    for (const cat of categoriesToDelete) {
      try {
        await cat.delete('Очистка категорий бота в тестовом режиме');
        deletedCategoriesCount++;
      } catch (e) {
        // Ignored
      }
    }

    // 3. Clear database configs
    await Promise.all([
      prisma.loggingConfig.updateMany({
        where: { guildId },
        data: {
          categoryId: null,
          messageLogsChannelId: null,
          memberLogsChannelId: null,
          roleLogsChannelId: null,
          channelLogsChannelId: null,
          voiceLogsChannelId: null,
          inviteLogsChannelId: null,
          botLogsChannelId: null,
          eventLogsChannelId: null,
        },
      }).catch(() => null),
      prisma.academyConfig.updateMany({
        where: { guildId },
        data: {
          categoryId: null,
          archiveCategoryId: null,
        },
      }).catch(() => null),
      prisma.academyChannel.deleteMany({ where: { guildId } }).catch(() => null),
      prisma.recruitmentConfig.updateMany({
        where: { guildId },
        data: {
          categoryId: null,
          channelId: null,
          logChannelId: null,
        },
      }).catch(() => null),
      prisma.voiceTrackerConfig.updateMany({
        where: { guildId },
        data: {
          controlChannelId: null,
          logChannelId: null,
        },
      }).catch(() => null),
      prisma.guildConfig.updateMany({
        where: { guildId },
        data: {
          leaveRequestChannelId: null,
          staticBindingChannelId: null,
          defaultEventChannelId: null,
          defaultVoiceChannelId: null,
        },
      }).catch(() => null),
    ]);

    await AuditLogger.recordEntry({
      guildId,
      action: 'TEST_MODE_PURGE_ALL_BOT_CHANNELS',
      category: 'BOT',
      title: 'Удаление всех каналов и категорий бота',
      description: `Удалено каналов: ${deletedChannelsCount}, категорий: ${deletedCategoriesCount}`,
      executorId: req.user!.userId,
      executorTag: req.user!.username,
    }).catch(() => null);

    return res.json({
      success: true,
      channelsCount: deletedChannelsCount,
      categoriesCount: deletedCategoriesCount,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/test-mode/wipe-profiles
 * Wipe all user profiles and characters (foreign-key safe)
 */
testModeRouter.post('/wipe-profiles', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);

    // Explicitly delete child relations first to prevent any SQLite foreign key constraints
    await prisma.userCharacter.deleteMany({});
    await prisma.mpReport.deleteMany({ where: { guildId } });
    await prisma.academyChannel.deleteMany({ where: { guildId } });
    await prisma.leaveRequest.deleteMany({ where: { guildId } });

    const deletedProfiles = await prisma.userProfile.deleteMany({
      where: { guildId },
    });

    await AuditLogger.recordEntry({
      guildId,
      action: 'TEST_MODE_WIPE_PROFILES',
      category: 'BOT',
      title: 'Сброс профилей',
      description: `Очищены все профили и статики (${deletedProfiles.count} профилей)`,
      executorId: req.user!.userId,
      executorTag: req.user!.username,
    }).catch(() => null);

    return res.json({ success: true, count: deletedProfiles.count });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/test-mode/wipe-academy
 * Wipe academy channels in Discord, database records, and MP reports
 */
testModeRouter.post('/wipe-academy', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const guild = await getDiscordGuild(guildId);

    let discordChannelsDeleted = 0;

    // 1. Delete Discord channels
    if (guild) {
      const dbChannels = await prisma.academyChannel.findMany({
        where: { guildId },
        select: { channelId: true },
      });

      const acadCfg = await prisma.academyConfig.findUnique({ where: { guildId } });
      const academyCatIds = new Set<string>();
      if (acadCfg?.categoryId) academyCatIds.add(acadCfg.categoryId);
      if (acadCfg?.archiveCategoryId) academyCatIds.add(acadCfg.archiveCategoryId);

      await guild.channels.fetch().catch(() => null);

      // Collect channel IDs to delete
      const toDelete = new Set<string>(dbChannels.map(c => c.channelId).filter(Boolean));

      // Also scan channels in academy categories or named 'академик-'
      for (const ch of guild.channels.cache.values()) {
        if (ch.type === ChannelType.GuildCategory) continue;
        if ((ch.parentId && academyCatIds.has(ch.parentId)) || ch.name.toLowerCase().startsWith('академик-')) {
          toDelete.add(ch.id);
        }
      }

      for (const chId of toDelete) {
        const ch = guild.channels.cache.get(chId);
        if (ch) {
          await ch.delete('Очистка каналов академии в тестовом режиме').catch(() => null);
          discordChannelsDeleted++;
        }
      }
    }

    // 2. Delete database records
    const deletedReports = await prisma.mpReport.deleteMany({
      where: { guildId },
    });
    const deletedChannels = await prisma.academyChannel.deleteMany({
      where: { guildId },
    });

    await AuditLogger.recordEntry({
      guildId,
      action: 'TEST_MODE_WIPE_ACADEMY',
      category: 'BOT',
      title: 'Сброс академии',
      description: `Очищена академия: ${deletedChannels.count} записей БД, ${discordChannelsDeleted} каналов Discord, ${deletedReports.count} отчетов`,
      executorId: req.user!.userId,
      executorTag: req.user!.username,
    }).catch(() => null);

    return res.json({
      success: true,
      channelsCount: deletedChannels.count,
      discordChannelsDeleted,
      reportsCount: deletedReports.count,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/test-mode/full-wipe
 * Full wipe of all bot operational data and Discord transient channels (academy, recruitment tickets)
 */
testModeRouter.post('/full-wipe', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const guild = await getDiscordGuild(guildId);

    // Delete academy & ticket channels in Discord if accessible
    if (guild) {
      await guild.channels.fetch().catch(() => null);
      const acadChannels = await prisma.academyChannel.findMany({ where: { guildId }, select: { channelId: true } });
      const appChannels = await prisma.recruitmentApplication.findMany({ where: { guildId }, select: { channelId: true } });

      const channelsToDelete = new Set<string>();
      for (const ac of acadChannels) {
        if (ac.channelId) channelsToDelete.add(ac.channelId);
      }
      for (const ap of appChannels) {
        if (ap.channelId) channelsToDelete.add(ap.channelId);
      }

      for (const ch of guild.channels.cache.values()) {
        const lower = ch.name.toLowerCase();
        if (lower.startsWith('академик-') || lower.startsWith('тикет-') || lower.startsWith('ticket-')) {
          channelsToDelete.add(ch.id);
        }
      }

      for (const id of channelsToDelete) {
        const ch = guild.channels.cache.get(id);
        if (ch) {
          await ch.delete('Полный вайп оперативных данных бота').catch(() => null);
        }
      }
    }

    // Delete in safe FK order
    await prisma.userCharacter.deleteMany({});
    await prisma.mpReport.deleteMany({ where: { guildId } });
    await prisma.academyChannel.deleteMany({ where: { guildId } });
    await prisma.leaveRequest.deleteMany({ where: { guildId } });
    await prisma.recruitmentApplication.deleteMany({ where: { guildId } });
    await prisma.eventParticipant.deleteMany({});
    await prisma.eventGathering.deleteMany({ where: { guildId } });
    await prisma.userProfile.deleteMany({ where: { guildId } });
    await prisma.voiceTrackerSession.deleteMany({ where: { guildId } });

    await AuditLogger.recordEntry({
      guildId,
      action: 'TEST_MODE_FULL_WIPE',
      category: 'BOT',
      title: 'Полный сброс оперативных данных',
      description: 'Выполнен полный сброс оперативных данных бота',
      executorId: req.user!.userId,
      executorTag: req.user!.username,
    }).catch(() => null);

    return res.json({ success: true, message: 'Все оперативные данные бота успешно сброшены' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default testModeRouter;
