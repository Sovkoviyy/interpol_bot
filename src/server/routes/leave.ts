import { Router, Response } from 'express';
import { TextChannel } from 'discord.js';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import prisma from '../../database/client';
import { LeaveService } from '../../bot/modules/leave/leaveService';
import { ServerSetupService } from '../../bot/modules/setup/serverSetupService';
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireGuildId } from "../middlewares/requireGuildId";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/leave/active
 * Get currently active leaves/time-offs with remaining time
 */
router.get('/active', requirePermission('manageLeaves', 'manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const active = await LeaveService.getActiveLeaves(guildId);
    res.json({ active });

}));

/**
 * GET /api/leave/logs
 * Get leave history & audit logs
 */
router.get('/logs', requirePermission('manageLeaves', 'manageRecruiting', 'manageSettings', 'viewLogs'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const logs = await LeaveService.getLeaveLogs(guildId);
    res.json({ logs });

}));

/**
 * GET /api/leave
 */
router.get('/', requirePermission('manageLeaves', 'manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const status = req.query.status as string;
    const requests = await LeaveService.getAllRequests(guildId, status);
    res.json({ requests });

}));

/**
 * POST /api/leave
 * Request a leave or time-off
 */
router.post('/', requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const userId = req.user?.userId || (req.user as any)?.id || 'unknown';
    const userTag = req.user?.username || 'Member';
    const { startDate, endDate, reason, type } = req.body;

    if (!startDate || !endDate || !reason) {
        return res.status(400).json({ error: 'Заполните все поля заявки' });
    }

    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
        return res.status(400).json({ error: 'Invalid date format for startDate or endDate' });
    }

    const leave = await LeaveService.requestLeave(
        guildId,
        userId,
        userTag,
        new Date(startDate),
        new Date(endDate),
        reason,
        (type === 'TIMEOFF' ? 'TIMEOFF' : 'VACATION')
    );

    res.json({ leave });

}));

/**
 * POST /api/leave/:id/review
 */
router.post('/:id/review', requirePermission('manageLeaves', 'manageRecruiting'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const userId = req.user?.userId || (req.user as any)?.id || 'unknown';
    const userTag = req.user?.username || 'Reviewer';
    const { approved, rejectionReason } = req.body;

    const updated = await LeaveService.reviewLeave(
        String(req.params.id),
        userId,
        userTag,
        Boolean(approved),
        rejectionReason
    );

    res.json({ leave: updated });

}));

/**
 * POST /api/leave/deploy-panel
 * Send interactive leave request message with button to Discord channel
 */
router.post('/deploy-panel', requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Укажите ID текстового канала' });

    const guildId = (req as any).guildId;


    const result = await ServerSetupService.deployPanel(guildId, 'leave', channelId);
    res.json(result);

}));

export default router;
