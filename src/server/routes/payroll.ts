import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import config from '../../config';
import { PayrollService } from '../../bot/modules/payroll/payrollService';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/payroll/config
 */
router.get('/config', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const cfg = await PayrollService.getConfig(guildId);
    res.json({ config: cfg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payroll/config
 */
router.post('/config', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const updated = await PayrollService.saveConfig(guildId, req.body);
    res.json({ config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/payroll/calculate
 */
router.get('/calculate', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
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
