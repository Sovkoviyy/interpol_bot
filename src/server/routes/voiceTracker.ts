import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { VoiceTrackerService } from '../../bot/modules/voiceTracker/voiceTrackerService';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/voice-tracker/config
 */
router.get('/config', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const cfg = await VoiceTrackerService.getConfig(guildId);
    res.json({ config: cfg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/voice-tracker/config
 */
router.post('/config', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const updated = await VoiceTrackerService.saveConfig(guildId, req.body);
    res.json({ config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/voice-tracker/sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
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
router.post('/start', async (req, res) => {
  try {
    const { eventName } = req.body;
    if (!eventName) return res.status(400).json({ error: 'Укажите название МП' });

    const guildId = config.discord.guildId;
    if (!guildId) return res.status(400).json({ error: 'GUILD_ID не настроен' });

    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const user: any = (req as any).user;
    const member = await guild.members.fetch(user.id).catch(() => null);
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
router.post('/end', async (req, res) => {
  try {
    const guildId = config.discord.guildId;
    if (!guildId) return res.status(400).json({ error: 'GUILD_ID не настроен' });

    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const user: any = (req as any).user;
    const member = await guild.members.fetch(user.id).catch(() => null);

    const session = await VoiceTrackerService.endSession(guild, member || undefined);
    res.json({ session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/voice-tracker/deploy-panel
 */
router.post('/deploy-panel', async (req, res) => {
  try {
    const { channelId } = req.body;
    const guildId = config.discord.guildId;
    if (!guildId) return res.status(400).json({ error: 'GUILD_ID не настроен' });

    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const msg = await VoiceTrackerService.postControlPanel(guild, channelId);
    res.json({ success: true, messageId: msg.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
