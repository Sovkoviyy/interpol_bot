import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { PayrollService } from '../../bot/modules/payroll/payrollService';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requireGuildId } from '../middlewares/requireGuildId';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/payroll/config
 */
router.get('/config', requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const cfg = await PayrollService.getConfig(guildId);
    res.json({ config: cfg });
}));

/**
 * POST /api/payroll/config
 */
router.post('/config', requirePermission('manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const updated = await PayrollService.saveConfig(guildId, req.body);
    res.json({ config: updated });
}));

/**
 * GET /api/payroll/calculate
 * Calculates live recruiter payroll activity (defaults to current week Monday-Sunday)
 */
router.get('/calculate', requirePermission('manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;

    const start = startStr ? new Date(startStr) : undefined;
    const end = endStr ? new Date(endStr) : undefined;

    const report = await PayrollService.calculatePayroll(guildId, start, end);
    res.json(report);
}));

/**
 * POST /api/payroll/archive-week
 * Explicitly finalize the current week, save payout records, announce in Discord, and reset for new week
 */
router.post('/archive-week', requirePermission('manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const executor = {
        id: req.user?.userId || 'unknown',
        tag: req.user?.username || 'Web Admin',
    };

    const result = await PayrollService.archiveAndResetWeek(guildId, { executor, isAutomatic: false });
    res.json({
        message: 'Неделя успешно закрыта, выплаты сформированы и опубликованы в Discord!',
        ...result,
    });
}));

/**
 * POST /api/payroll/reset
 * Legacy/generic reset endpoint: if recruiterId is passed, resets single recruiter. Otherwise archives and resets week.
 */
router.post('/reset', requirePermission('manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const { recruiterId } = req.body;
    const executor = {
        id: req.user?.userId || 'unknown',
        tag: req.user?.username || 'Web Admin',
    };

    if (recruiterId) {
        const result = await PayrollService.resetSingleRecruiter(guildId, recruiterId, executor);
        return res.json({
            message: 'Статистика рекрутера успешно обнулена',
            ...result,
        });
    }

    const result = await PayrollService.archiveAndResetWeek(guildId, { executor, isAutomatic: false });
    return res.json({
        message: 'Статистика всех рекрутеров обнулена, выплаты сформированы',
        ...result,
    });
}));

/**
 * POST /api/payroll/reset-clear
 * Clear reset checkpoint (reverts to standard period filtering)
 */
router.post('/reset-clear', requirePermission('manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const { recruiterId } = req.body;

    const result = await PayrollService.clearReset(guildId, recruiterId);
    res.json(result);
}));

/**
 * GET /api/payroll/history
 * List archived payout records
 */
router.get('/history', requirePermission('manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string, 10) || 100;

    const records = await PayrollService.getPayoutHistory(guildId, { status, limit });
    res.json({ records });
}));

/**
 * PATCH /api/payroll/payouts/:id
 * Mark a payout record as PAID or PENDING
 */
router.patch('/payouts/:id', requirePermission('manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const id = req.params.id as string;
    const { status } = req.body;

    if (status !== 'PAID' && status !== 'PENDING') {
        return res.status(400).json({ error: 'Status must be PAID or PENDING' });
    }

    const updated = await PayrollService.updatePayoutStatus(guildId, id, status, req.user?.userId);
    res.json({ record: updated });
}));

/**
 * DELETE /api/payroll/payouts/:id
 * Delete a specific payout record
 */
router.delete('/payouts/:id', requirePermission('manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const id = req.params.id as string;

    await PayrollService.deletePayoutRecord(guildId, id);
    res.json({ success: true });
}));

export default router;
