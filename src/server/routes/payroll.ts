import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import { PayrollService } from '../../bot/modules/payroll/payrollService';

const router = Router();

router.use(requireAuth);

function resolveGuildId(req: AuthenticatedRequest): string {
  const headerGuild = req.headers['x-guild-id'] as string;
  return headerGuild || req.user?.guildId || config.discord.guildId || 'default';
}

/**
 * GET /api/payroll/config
 */
router.get('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const cfg = await PayrollService.getConfig(guildId);
    res.json({ config: cfg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payroll/config
 */
router.post('/config', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const updated = await PayrollService.saveConfig(guildId, req.body);
    res.json({ config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/payroll/calculate
 */
router.get('/calculate', requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;

    const start = startStr ? new Date(startStr) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const end = endStr ? new Date(endStr) : new Date();

    const report = await PayrollService.calculatePayroll(guildId, start, end);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
