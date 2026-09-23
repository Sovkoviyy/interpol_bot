import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import bot from '../../bot/client';
import { AntiNukeService } from '../../bot/modules/antiNuke/antiNukeService';

import { resolveGuildId } from '../utils/guild';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/anti-nuke/config
 */
router.get('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const cfg = await AntiNukeService.getConfig(guildId);
    res.json({ config: cfg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/anti-nuke/config
 */
router.post('/config', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const updated = await AntiNukeService.saveConfig(guildId, req.body);
    res.json({ config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/anti-nuke/snapshots
 */
router.get('/snapshots', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const snapshots = await AntiNukeService.listSnapshots(guildId);
    res.json({ snapshots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/anti-nuke/snapshots
 */
router.post('/snapshots', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    if (!guildId || guildId === 'default') return res.status(400).json({ error: 'Сервер Discord не выбран' });

    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const userId = req.user?.userId || (req.user as any)?.id || 'unknown';
    const userTag = req.user?.username || 'Admin';
    const { name } = req.body;

    const snapshot = await AntiNukeService.createSnapshot(
      guild,
      name,
      userId,
      userTag
    );

    res.json({ snapshot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
