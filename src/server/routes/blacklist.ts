import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import { BlacklistService } from '../../bot/modules/blacklist/blacklistService';
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireGuildId } from "../middlewares/requireGuildId";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/blacklist
 */
router.get('/', requirePermission('manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const search = req.query.search as string;
    const entries = await BlacklistService.listEntries(guildId, search);
    res.json({ entries });

}));

/**
 * POST /api/blacklist
 */
router.post('/', requirePermission('manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
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

}));

/**
 * DELETE /api/blacklist/:id
 */
router.delete('/:id', requirePermission('manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    await BlacklistService.removeEntry(guildId, String(req.params.id));
    res.json({ success: true });

}));

export default router;
