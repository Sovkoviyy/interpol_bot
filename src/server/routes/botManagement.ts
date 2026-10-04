import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { getBotStatus, restartBot } from '../../bot';
import { asyncHandler } from "../middlewares/asyncHandler";

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
router.post('/restart', requirePermission('manageSettings'), asyncHandler(async (req, res) => {

    const result = await restartBot();
    res.json(result);

}));

export default router;
