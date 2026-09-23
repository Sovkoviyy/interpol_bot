import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { VoiceTrackerService } from '../../bot/modules/voiceTracker/voiceTrackerService';

const router = Router();

router.use(requireAuth);

function resolveGuildId(req: AuthenticatedRequest): string {
  const headerGuild = req.headers['x-guild-id'] as string;
  return headerGuild || req.user?.guildId || config.discord.guildId || 'default';
}

/**
 * GET /api/voice-tracker/config
 */
router.get('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const cfg = await VoiceTrackerService.getConfig(guildId);
    res.json({ config: cfg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/voice-tracker/config
 */
router.post('/config', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const updated = await VoiceTrackerService.saveConfig(guildId, req.body);
    res.json({ config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/voice-tracker/sessions
 */
router.get('/sessions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const sessions = await prisma.voiceTrackerSession.findMany({
      where: { guildId },
      orderBy: { startedAt: 'desc' },
      take: 30,
    });
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/voice-tracker/start
 */
router.post('/start', requirePermission('manageEvents'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { eventName } = req.body;
    if (!eventName) return res.status(400).json({ error: 'Укажите название МП' });

    const guildId = resolveGuildId(req);
    if (!guildId || guildId === 'default') return res.status(400).json({ error: 'Сервер Discord не выбран' });

    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const userId = req.user?.userId || (req.user as any)?.id;
    const member = userId ? await guild.members.fetch(userId).catch(() => null) : null;
    if (!member) return res.status(400).json({ error: 'Пользователь не найден на сервере' });

    const session = await VoiceTrackerService.startSession(guild, eventName, member);
    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/voice-tracker/end
 */
router.post('/end', requirePermission('manageEvents'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    if (!guildId || guildId === 'default') return res.status(400).json({ error: 'Сервер Discord не выбран' });

    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const userId = req.user?.userId || (req.user as any)?.id;
    const member = userId ? await guild.members.fetch(userId).catch(() => null) : null;

    const session = await VoiceTrackerService.endSession(guild, member || undefined);
    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/voice-tracker/deploy-panel
 */
router.post('/deploy-panel', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { channelId } = req.body;
    const guildId = resolveGuildId(req);
    if (!guildId || guildId === 'default') return res.status(400).json({ error: 'Сервер Discord не выбран' });

    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const channel = channelId ? guild.channels.cache.get(channelId) : null;
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Текстовый канал не найден' });
    }

    const msg = await VoiceTrackerService.postControlPanel(guild, channelId);
    res.json({ success: true, messageId: msg.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
