import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import { BlacklistService } from '../../bot/modules/blacklist/blacklistService';

import { resolveGuildId } from '../utils/guild';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/blacklist
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
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
router.post('/', requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const userId = req.user?.userId || (req.user as any)?.id || 'unknown';
    const userTag = req.user?.username || 'Recruiter';
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
      addedById: userId,
      addedByTag: userTag,
    });

    res.json({ entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/blacklist/:id
 */
router.delete('/:id', requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    await BlacklistService.removeEntry(guildId, String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
