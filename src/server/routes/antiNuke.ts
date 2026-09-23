import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import config from '../../config';
import bot from '../../bot/client';
import { AntiNukeService } from '../../bot/modules/antiNuke/antiNukeService';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/anti-nuke/config
 */
router.get('/config', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const cfg = await AntiNukeService.getConfig(guildId);
    res.json({ config: cfg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/anti-nuke/config
 */
router.post('/config', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const updated = await AntiNukeService.saveConfig(guildId, req.body);
    res.json({ config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/anti-nuke/snapshots
 */
router.get('/snapshots', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const snapshots = await AntiNukeService.listSnapshots(guildId);
    res.json({ snapshots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/anti-nuke/snapshots
 */
router.post('/snapshots', async (req, res) => {
  try {
    const guildId = config.discord.guildId;
    if (!guildId) return res.status(400).json({ error: 'GUILD_ID не настроен' });

    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const user: any = (req as any).user;
    const { name } = req.body;

    const snapshot = await AntiNukeService.createSnapshot(
      guild,
      name,
      user.id,
      user.tag || user.username
    );

    res.json({ snapshot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
