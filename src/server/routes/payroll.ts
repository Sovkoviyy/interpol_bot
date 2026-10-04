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
router.post('/config', requirePermission('manageRecruiting', 'manageSettings', 'managePayroll'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const updated = await PayrollService.saveConfig(guildId, req.body);
    res.json({ config: updated });
}));

/**
 * GET /api/payroll/calculate
 * Calculates live recruiter payroll activity (defaults to current week Monday-Sunday)
 */
router.get('/calculate', requirePermission('manageRecruiting', 'managePayroll'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;

    const start = startStr ? new Date(startStr) : undefined;
    const end = endStr ? new Date(endStr) : undefined;

    const report = await PayrollService.calculatePayroll(guildId, start, end);
    res.json(report);
}));

/**
 * GET /api/payroll/export
 * Returns the strictly formatted bank payout CSV (staticId;amount;comment)
 */
router.get('/export', requirePermission('manageRecruiting', 'managePayroll'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const comment = (req.query.comment as string) || 'Премия';
    const source = (req.query.source as string) || 'current';
    const onlyPositive = req.query.onlyPositive !== 'false';

    let records: Array<{ staticId?: string | null; totalPayout: number }> = [];

    if (source === 'history') {
        const history = await PayrollService.getPayoutHistory(guildId, { status: req.query.status as string, limit: 500 });
        records = history.map(h => ({ staticId: h.staticId, totalPayout: h.totalPayout }));
    } else {
        const report = await PayrollService.calculatePayroll(guildId);
        records = report.recruiters.map(r => ({ staticId: r.staticId, totalPayout: r.totalPayout }));
    }

    const textContent = PayrollService.generateBankExport(records, comment, onlyPositive);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payout_template.txt"');
    res.send('\uFEFF' + textContent);
}));

/**
 * POST /api/payroll/archive-week
 * Explicitly finalize the current week, save payout records, announce in Discord, and reset for new week
 */
router.post('/archive-week', requirePermission('manageRecruiting', 'manageSettings', 'managePayroll'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
 * If recruiterId is passed, resets single recruiter.
 * If archive=true, archives week and creates payouts.
 * Otherwise resets active stats cleanly to zero.
 */
router.post('/reset', requirePermission('manageRecruiting', 'manageSettings', 'managePayroll'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const { recruiterId, archive } = req.body;
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

    if (archive) {
        const result = await PayrollService.archiveAndResetWeek(guildId, { executor, isAutomatic: false });
        return res.json({
            message: 'Неделя успешно закрыта, выплаты сформированы',
            ...result,
        });
    }

    const result = await PayrollService.resetActiveStats(guildId, executor);
    return res.json({
        message: 'Статистика всех рекрутеров за текущую неделю успешно обнулена',
        ...result,
    });
}));

/**
 * POST /api/payroll/reset-clear
 * Clear reset checkpoint (reverts to standard period filtering)
 */
router.post('/reset-clear', requirePermission('manageRecruiting', 'manageSettings', 'managePayroll'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const { recruiterId } = req.body;

    const result = await PayrollService.clearReset(guildId, recruiterId);
    res.json(result);
}));

/**
 * GET /api/payroll/history
 * List archived payout records
 */
router.get('/history', requirePermission('manageRecruiting', 'managePayroll'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
router.patch('/payouts/:id', requirePermission('manageRecruiting', 'manageSettings', 'managePayroll'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
router.delete('/payouts/:id', requirePermission('manageRecruiting', 'manageSettings', 'managePayroll'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const id = req.params.id as string;

    await PayrollService.deletePayoutRecord(guildId, id);
    res.json({ success: true });
}));

export default router;
