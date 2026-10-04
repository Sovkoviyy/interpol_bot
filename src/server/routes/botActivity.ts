import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import prisma from '../../database/client';
import botActivityManager from '../../bot/modules/activity/activityManager';
import { asyncHandler } from "../middlewares/asyncHandler";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/activity
 * Retrieve current configuration, live Discord status and available placeholders
 */
router.get('/', asyncHandler(async (req, res) => {

    const snapshot = await botActivityManager.getDashboardSnapshot();
    res.json(snapshot);

}));

/**
 * PUT /api/activity
 * Update bot activity configuration and immediately apply it to Discord
 */
router.put('/', requirePermission('manageSettings', 'settings.botMessages', 'settings.activity'), asyncHandler(async (req, res) => {

    const {
        enabled,
        status,
        mode,
        rotationInterval,
        activityType,
        activityName,
        activityState,
        streamingUrl,
        activities,
    } = req.body;

    const activitiesJson = Array.isArray(activities)
        ? JSON.stringify(activities)
        : typeof req.body.activitiesJson === 'string'
            ? req.body.activitiesJson
            : '[]';

    const updated = await prisma.botActivityConfig.upsert({
        where: { id: 'default' },
        update: {
            enabled: typeof enabled === 'boolean' ? enabled : true,
            status: status || 'online',
            mode: mode === 'ROTATING' ? 'ROTATING' : 'STATIC',
            rotationInterval: Number(rotationInterval) || 30,
            activityType: activityType || 'PLAYING',
            activityName: typeof activityName === 'string' ? activityName : '',
            activityState: typeof activityState === 'string' ? activityState : '',
            streamingUrl: typeof streamingUrl === 'string' ? streamingUrl : '',
            activitiesJson,
        },
        create: {
            id: 'default',
            enabled: typeof enabled === 'boolean' ? enabled : true,
            status: status || 'online',
            mode: mode === 'ROTATING' ? 'ROTATING' : 'STATIC',
            rotationInterval: Number(rotationInterval) || 30,
            activityType: activityType || 'PLAYING',
            activityName: typeof activityName === 'string' ? activityName : '',
            activityState: typeof activityState === 'string' ? activityState : '',
            streamingUrl: typeof streamingUrl === 'string' ? streamingUrl : '',
            activitiesJson,
        },
    });

    // Apply live to Discord bot immediately
    await botActivityManager.applyActivity();

    const snapshot = await botActivityManager.getDashboardSnapshot();
    res.json({ success: true, config: updated, snapshot });

}));

/**
 * POST /api/activity/reset
 * Disable and clear bot presence
 */
router.post('/reset', requirePermission('manageSettings', 'settings.botMessages', 'settings.activity'), asyncHandler(async (req, res) => {

    await prisma.botActivityConfig.upsert({
        where: { id: 'default' },
        update: { enabled: false },
        create: { id: 'default', enabled: false },
    });

    await botActivityManager.applyActivity();
    const snapshot = await botActivityManager.getDashboardSnapshot();
    res.json({ success: true, message: 'Активность бота сброшена', snapshot });

}));

/**
 * POST /api/activity/apply
 * Force immediately re-apply current activity to Discord Gateway
 */
router.post('/apply', requirePermission('manageSettings', 'settings.botMessages', 'settings.activity'), asyncHandler(async (req, res) => {

    await botActivityManager.applyActivity();
    const snapshot = await botActivityManager.getDashboardSnapshot();
    res.json({ success: true, message: 'Активность успешно применена в Discord', snapshot });

}));

export default router;
