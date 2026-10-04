import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { AcademyService } from '../../bot/modules/academy/academyService';
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireGuildId } from "../middlewares/requireGuildId";
import { requireBot } from "../middlewares/requireBot";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/academy/config
 */
router.get('/config', requirePermission('manageAcademy', 'manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const academyConfig = await AcademyService.getConfig(guildId);
    res.json({ config: academyConfig });

}));

/**
 * POST /api/academy/config
 */
router.post('/config', requirePermission('manageAcademy', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const updated = await AcademyService.saveConfig(guildId, req.body);
    res.json({ config: updated });

}));

/**
 * GET /api/academy/channels
 */
router.get('/channels', requirePermission('manageAcademy', 'manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const channels = await prisma.academyChannel.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
        include: {
            reports: {
                orderBy: { createdAt: 'desc' },
            },
        },
    });
    res.json({ channels });

}));

/**
 * GET /api/academy/reports
 */
router.get('/reports', requirePermission('manageAcademy', 'manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const status = req.query.status as string;

    const reports = await prisma.mpReport.findMany({
        where: {
            guildId,
            ...(status && status !== 'ALL' ? { status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    res.json({ reports });

}));

/**
 * POST /api/academy/reports/:id/review
 */
router.post('/reports/:id/review', requirePermission('manageAcademy', 'manageRecruiting'), requireGuildId, requireBot, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const { approved, rejectionReason } = req.body;
    const reportId = String(req.params.id);

    const guildId = (req as any).guildId;


    const guild = ((req as any).botClient as import('discord.js').Client).guilds.cache.get(guildId) || await ((req as any).botClient as import('discord.js').Client).guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const userId = req.user?.userId || (req.user as any)?.id;
    const reviewerMember = userId ? await guild.members.fetch(userId).catch(() => null) : null;
    if (!reviewerMember) return res.status(400).json({ error: 'Рекрутер не найден на сервере' });

    const reviewed = await AcademyService.reviewReport(
        reportId,
        reviewerMember,
        Boolean(approved),
        rejectionReason
    );

    res.json({ report: reviewed });

}));

/**
 * POST /api/academy/channels/:id/promote
 */
router.post('/channels/:id/promote', requirePermission('manageAcademy', 'manageRecruiting'), requireGuildId, requireBot, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const { approved, rejectionReason, penaltyMp } = req.body;
    const channelId = String(req.params.id);

    const guildId = (req as any).guildId;


    const guild = ((req as any).botClient as import('discord.js').Client).guilds.cache.get(guildId) || await ((req as any).botClient as import('discord.js').Client).guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const userId = req.user?.userId || (req.user as any)?.id;
    const reviewerMember = userId ? await guild.members.fetch(userId).catch(() => null) : null;
    if (!reviewerMember) return res.status(400).json({ error: 'Рекрутер не найден на сервере' });

    await AcademyService.promoteAcademician(
        channelId,
        reviewerMember,
        Boolean(approved),
        rejectionReason,
        penaltyMp ? parseInt(penaltyMp, 10) : undefined
    );

    res.json({ success: true });

}));

/**
 * PUT /api/academy/channels/:id
 * Edit an academy student profile
 */
router.put('/channels/:id', requirePermission('manageAcademy', 'manageRecruiting'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const id = String(req.params.id);
    const { staticId, approvedMpCount, requiredMp, penaltyMp, status } = req.body;

    const existing = await prisma.academyChannel.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Профиль ученика не найден' });

    const updated = await prisma.academyChannel.update({
        where: { id },
        data: {
            ...(staticId !== undefined ? { staticId: staticId ? String(staticId).trim() : null } : {}),
            ...(approvedMpCount !== undefined ? { approvedMpCount: parseInt(approvedMpCount, 10) || 0 } : {}),
            ...(requiredMp !== undefined ? { requiredMp: parseInt(requiredMp, 10) || 10 } : {}),
            ...(penaltyMp !== undefined ? { penaltyMp: parseInt(penaltyMp, 10) || 0 } : {}),
            ...(status ? { status } : {}),
        },
        include: {
            reports: { orderBy: { createdAt: 'desc' } },
        },
    });

    res.json({ channel: updated });

}));

/**
 * DELETE /api/academy/channels/:id
 * Delete an academy student profile (and its reports)
 */
router.delete('/channels/:id', requirePermission('manageAcademy', 'manageRecruiting'), requireBot, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const id = String(req.params.id);
    const existing = await prisma.academyChannel.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Профиль ученика не найден' });

    // Delete reports first
    await prisma.mpReport.deleteMany({ where: { academyChannelId: id } }).catch(() => null);

    // Delete channel from Discord if still exists
    const guild = ((req as any).botClient as import('discord.js').Client).guilds.cache.get(existing.guildId) || await ((req as any).botClient as import('discord.js').Client).guilds.fetch(existing.guildId).catch(() => null);
    if (guild && existing.channelId) {
        const ch = guild.channels.cache.get(existing.channelId) || await guild.channels.fetch(existing.channelId).catch(() => null);
        if (ch) {
            await ch.delete('Удаление профиля ученика через панель управления').catch(() => null);
        }
    }

    // Delete from DB
    await prisma.academyChannel.delete({ where: { id } });

    res.json({ success: true });

}));

/**
 * DELETE /api/academy/reports/:id
 * Delete a specific report (fake/spam)
 */
router.delete('/reports/:id', requirePermission('manageAcademy', 'manageRecruiting'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const id = String(req.params.id);
    const report = await prisma.mpReport.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: 'Отчет не найден' });

    await prisma.mpReport.delete({ where: { id } });
    res.json({ success: true });

}));

export default router;
