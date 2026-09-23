import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { getBotStatus, restartBot } from '../../bot';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/bot/status
 */
router.get('/status', (req, res) => {
  try {
    const status = getBotStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/bot/restart
 * Dynamically reloads the Discord bot without stopping Express
 */
router.post('/restart', async (req, res) => {
  try {
    const result = await restartBot();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка перезапуска бота' });
  }
});

export default router;
