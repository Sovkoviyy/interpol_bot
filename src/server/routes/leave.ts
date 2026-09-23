import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import config from '../../config';
import { LeaveService } from '../../bot/modules/leave/leaveService';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/leave
 */
router.get('/', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const status = req.query.status as string;
    const requests = await LeaveService.getAllRequests(guildId, status);
    res.json({ requests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/leave
 * Request a leave
 */
router.post('/', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const user: any = (req as any).user;
    const { startDate, endDate, reason } = req.body;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'Заполните все поля заявки' });
    }

    const leave = await LeaveService.requestLeave(
      guildId,
      user.id,
      user.tag || user.username,
      new Date(startDate),
      new Date(endDate),
      reason
    );

    res.json({ leave });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/leave/:id/review
 */
router.post('/:id/review', async (req, res) => {
  try {
    const user: any = (req as any).user;
    const { approved, rejectionReason } = req.body;

    const updated = await LeaveService.reviewLeave(
      req.params.id,
      user.id,
      user.tag || user.username,
      Boolean(approved),
      rejectionReason
    );

    res.json({ leave: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
