import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import { PayrollService } from '../../bot/modules/payroll/payrollService';
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireGuildId } from "../middlewares/requireGuildId";

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
router.post('/config', (req: AuthenticatedRequest, res: Response, next: any) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.permissions?.isAdmin || req.user.permissions?.manageRecruiting || req.user.permissions?.manageSettings) {
        return next();
    }
    return res.status(403).json({ error: 'Forbidden: You do not have permission to manage recruiter rates' });
}, requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const updated = await PayrollService.saveConfig(guildId, req.body);
    res.json({ config: updated });

}));

/**
 * GET /api/payroll/calculate
 */
router.get('/calculate', requirePermission('manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;

    const start = startStr ? new Date(startStr) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const end = endStr ? new Date(endStr) : new Date();

    const report = await PayrollService.calculatePayroll(guildId, start, end);
    res.json(report);

}));

/**
 * POST /api/payroll/reset
 * Reset stats for all recruiters or an individual recruiter
 */
router.post('/reset', requirePermission('manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const { recruiterId } = req.body;
    const executor = {
        id: req.user?.userId || 'unknown',
        tag: req.user?.username ? `${req.user.username}#${req.user.discriminator || '0'}` : 'Web Admin',
    };

    const result = await PayrollService.resetStats(guildId, recruiterId, executor);
    res.json({
        message: recruiterId ? 'Статистика рекрутера успешно обнулена' : 'Статистика всех рекрутеров успешно обнулена',
        ...result,
    });

}));

/**
 * POST /api/payroll/reset-clear
 * Clear reset checkpoint (reverts to standard period filtering)
 */
router.post('/reset-clear', requirePermission('manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const { recruiterId } = req.body;

    const result = await PayrollService.clearReset(guildId, recruiterId);
    res.json(result);

}));

export default router;
