import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import prisma from '../../database/client';
import honeypotManager from '../../bot/modules/honeypot/honeypotManager';
import bot from '../../bot/client';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/honeypot
 * Retrieve honeypot config, statistics, and recent caught spam logs
 */
router.get('/', async (req, res) => {
  try {
    const config = await honeypotManager.getConfig();

    const [recentLogs, totalLogs] = await Promise.all([
      prisma.honeypotLog.findMany({
        orderBy: { caughtAt: 'desc' },
        take: 50,
      }),
      prisma.honeypotLog.count(),
    ]);

    let channelDetails: any = null;
    if (config.channelId && bot.isReady()) {
      const ch = bot.channels.cache.get(config.channelId);
      if (ch) {
        channelDetails = {
          id: ch.id,
          name: (ch as any).name,
          guildId: (ch as any).guildId,
        };
      }
    }

    const requestedGuildId = (req.query.guildId as string) || (req.headers['x-guild-id'] as string) || config.guildId;
    let guild = requestedGuildId && requestedGuildId !== 'default'
      ? (bot.guilds.cache.get(requestedGuildId) || await bot.guilds.fetch(requestedGuildId).catch(() => null))
      : null;

    if (!guild && bot.guilds.cache.size > 0) {
      guild = bot.guilds.cache.first() || null;
    }

    let channels: any[] = [];
    let roles: any[] = [];

    if (guild) {
      try {
        const fetchedChannels = await guild.channels.fetch();
        channels = Array.from(fetchedChannels.values())
          .filter((c): c is any => c !== null)
          .map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            parentId: c.parentId,
          }));
      } catch (err: any) {
        console.warn('⚠️ [Honeypot] Channel fetch error, fallback to cache:', err?.message);
        channels = Array.from(guild.channels.cache.values()).map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          parentId: c.parentId,
        }));
      }

      try {
        const fetchedRoles = await guild.roles.fetch();
        roles = Array.from(fetchedRoles.values())
          .filter((r) => r.name !== '@everyone')
          .sort((a, b) => b.position - a.position)
          .map((r) => ({
            id: r.id,
            name: r.name,
            color: r.color,
            position: r.position,
          }));
      } catch (err: any) {
        console.warn('⚠️ [Honeypot] Role fetch error, fallback to cache:', err?.message);
        roles = Array.from(guild.roles.cache.values())
          .filter((r) => r.name !== '@everyone')
          .sort((a, b) => b.position - a.position)
          .map((r) => ({
            id: r.id,
            name: r.name,
            color: r.color,
            position: r.position,
          }));
      }
    }

    const guilds = Array.from(bot.guilds.cache.values()).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL(),
    }));

    res.json({
      config,
      channelDetails,
      recentLogs,
      totalLogs,
      channels,
      roles,
      guilds,
      selectedGuildId: guild?.id || null,
      isBotOnline: bot.isReady(),
    });
  } catch (err: any) {
    console.error('[API Honeypot] Error fetching config:', err);
    res.status(500).json({ error: err.message || 'Ошибка загрузки настроек канала-ловушки' });
  }
});

/**
 * PUT /api/honeypot
 * Save honeypot configuration
 */
router.put('/', requirePermission('manageSettings'), async (req, res) => {
  try {
    const {
      enabled,
      action,
      channelId,
      channelName,
      deleteSeconds,
      whitelistRoles,
      embedTitle,
      embedDescription,
    } = req.body;

    const whitelistStr = Array.isArray(whitelistRoles)
      ? JSON.stringify(whitelistRoles)
      : typeof whitelistRoles === 'string'
      ? whitelistRoles
      : '[]';

    const updated = await prisma.honeypotConfig.upsert({
      where: { id: 'default' },
      update: {
        enabled: typeof enabled === 'boolean' ? enabled : true,
        action: action === 'BAN' ? 'BAN' : 'KICK',
        channelId: channelId || null,
        channelName: channelName || 'канал-ловушка',
        deleteSeconds: Number(deleteSeconds) || 600,
        whitelistRoles: whitelistStr,
        embedTitle: embedTitle || '🛡️ Канал-ловушка автомодерации',
        embedDescription: embedDescription || '⚠️ **НЕ ПИШИТЕ СООБЩЕНИЯ В ЭТОТ КАНАЛ**\n\nЭтот канал используется для выявления спам-ботов.\nЛюбое сообщение здесь приведёт к немедленной блокировке.',
      },
      create: {
        id: 'default',
        enabled: typeof enabled === 'boolean' ? enabled : true,
        action: action === 'BAN' ? 'BAN' : 'KICK',
        channelId: channelId || null,
        channelName: channelName || 'канал-ловушка',
        deleteSeconds: Number(deleteSeconds) || 600,
        whitelistRoles: whitelistStr,
        embedTitle: embedTitle || '🛡️ Канал-ловушка автомодерации',
        embedDescription: embedDescription || '⚠️ **НЕ ПИШИТЕ СООБЩЕНИЯ В ЭТОТ КАНАЛ**\n\nЭтот канал используется для выявления спам-ботов.\nЛюбое сообщение здесь приведёт к немедленной блокировке.',
      },
    });

    // Refresh warning message if channel is configured
    await honeypotManager.refreshWarningMessage();

    res.json({ success: true, config: updated });
  } catch (err: any) {
    console.error('[API Honeypot] Error updating config:', err);
    res.status(500).json({ error: err.message || 'Ошибка сохранения настроек' });
  }
});

/**
 * POST /api/honeypot/setup-channel
 * Automatically create or re-provision the trap channel on Discord
 */
router.post('/setup-channel', requirePermission('manageSettings'), async (req, res) => {
  try {
    const targetGuildId = req.body.guildId || (req.headers['x-guild-id'] as string);
    const result = await honeypotManager.setupChannel(targetGuildId);
    res.json(result);
  } catch (err: any) {
    console.error('[API Honeypot] Error setting up channel:', err);
    res.status(500).json({ error: err.message || 'Ошибка создания канала-ловушки' });
  }
});

/**
 * POST /api/honeypot/refresh-embed
 * Refresh embed message in channel
 */
router.post('/refresh-embed', requirePermission('manageSettings'), async (req, res) => {
  try {
    await honeypotManager.refreshWarningMessage();
    res.json({ success: true, message: 'Сообщение в канале обновлено' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка обновления сообщения' });
  }
});

/**
 * POST /api/honeypot/reset-counter
 * Reset the caught counter
 */
router.post('/reset-counter', requirePermission('manageSettings'), async (req, res) => {
  try {
    const updated = await prisma.honeypotConfig.update({
      where: { id: 'default' },
      data: { totalCaught: 0 },
    });
    await honeypotManager.refreshWarningMessage();
    res.json({ success: true, totalCaught: updated.totalCaught });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка сброса счетчика' });
  }
});

/**
 * DELETE /api/honeypot/logs
 * Clear log history
 */
router.delete('/logs', requirePermission('manageSettings'), async (req, res) => {
  try {
    await prisma.honeypotLog.deleteMany({});
    res.json({ success: true, message: 'История логов очищена' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка очистки логов' });
  }
});

export default router;
