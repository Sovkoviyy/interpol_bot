import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import config from '../../config';
import { BlacklistService } from '../../bot/modules/blacklist/blacklistService';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/blacklist
 */
router.get('/', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const search = req.query.search as string;
    const entries = await BlacklistService.listEntries(guildId, search);
    res.json({ entries });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/blacklist
 */
router.post('/', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const user: any = (req as any).user;
    const { staticId, discordId, name, reason, proofUrl } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Укажите причину внесения в ЧС' });
    }

    const entry = await BlacklistService.addEntry(guildId, {
      staticId,
      discordId,
      name,
      reason,
      proofUrl,
      addedById: user.id,
      addedByTag: user.tag || user.username,
    });

    res.json({ entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/blacklist/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    await BlacklistService.removeEntry(guildId, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
