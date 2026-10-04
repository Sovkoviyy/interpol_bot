import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { TierService } from '../../bot/modules/tier/tierService';
import { getDiscordGuild } from '../utils/guild';
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireGuildId } from "../middlewares/requireGuildId";
import { requireBot } from "../middlewares/requireBot";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/tier/config
 */
router.get('/config', requirePermission('manageTier', 'manageEvents', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const tierConfig = await TierService.getConfig(guildId);
    res.json({ config: tierConfig });

}));

/**
 * POST /api/tier/config
 */
router.post('/config', requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const { categoryId, applyChannelId, reviewChannelId, checkerRoleId, enabled } = req.body;

    const updated = await prisma.tierConfig.upsert({
        where: { guildId },
        update: {
            ...(categoryId !== undefined && { categoryId }),
            ...(applyChannelId !== undefined && { applyChannelId }),
            ...(reviewChannelId !== undefined && { reviewChannelId }),
            ...(checkerRoleId !== undefined && { checkerRoleId }),
            ...(enabled !== undefined && { enabled: Boolean(enabled) }),
        },
        create: {
            guildId,
            categoryId: categoryId || null,
            applyChannelId: applyChannelId || null,
            reviewChannelId: reviewChannelId || null,
            checkerRoleId: checkerRoleId || null,
            enabled: enabled !== undefined ? Boolean(enabled) : true,
        },
    });

    res.json({ config: updated });

}));

/**
 * POST /api/tier/setup
 * Automatically provision category, channels, and checker role in Discord
 */
router.post('/setup', requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const guild = await getDiscordGuild(guildId);
    if (!guild) {
        return res.status(400).json({ error: 'Сервер Discord не подключен' });
    }

    const result = await TierService.setupTierStructure(guild);
    res.json({ success: true, result });

}));

/**
 * GET /api/tier/tickets
 */
router.get('/tickets', requirePermission('manageTier', 'manageEvents', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const tickets = await prisma.tierTicket.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
        include: {
            submissions: {
                orderBy: { createdAt: 'desc' },
            },
        },
    });
    res.json({ tickets });

}));

/**
 * GET /api/tier/submissions
 */
router.get('/submissions', requirePermission('manageTier', 'manageEvents', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const { status, mpType } = req.query;

    const where: any = { guildId };
    if (status && typeof status === 'string') {
        where.status = status;
    }
    if (mpType && typeof mpType === 'string') {
        where.mpType = mpType;
    }

    const submissions = await prisma.tierSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            ticket: true,
        },
    });

    res.json({ submissions });

}));

/**
 * PUT /api/tier/tickets/:id
 * Edit a tier ticket
 */
router.put('/tickets/:id', requirePermission('manageTier', 'manageEvents', 'manageSettings'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const id = String(req.params.id);
    const { status } = req.body;

    const ticket = await prisma.tierTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Тикет тира не найден' });

    const updated = await prisma.tierTicket.update({
        where: { id },
        data: {
            ...(status ? { status } : {}),
        },
        include: { submissions: true },
    });

    res.json({ ticket: updated });

}));

/**
 * DELETE /api/tier/tickets/:id
 * Delete a tier ticket (and all its submissions)
 */
router.delete('/tickets/:id', requirePermission('manageTier', 'manageEvents', 'manageSettings'), requireBot, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const id = String(req.params.id);
    const ticket = await prisma.tierTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: 'Тикет тира не найден' });

    // Delete Discord channel if exists
    const guild = ((req as any).botClient as import('discord.js').Client).guilds.cache.get(ticket.guildId) || await ((req as any).botClient as import('discord.js').Client).guilds.fetch(ticket.guildId).catch(() => null);
    if (guild && ticket.channelId) {
        const ch = guild.channels.cache.get(ticket.channelId) || await guild.channels.fetch(ticket.channelId).catch(() => null);
        if (ch) {
            await ch.delete('Удаление тикета тира через панель').catch(() => null);
        }
    }

    // Delete submissions
    await prisma.tierSubmission.deleteMany({ where: { ticketId: id } }).catch(() => null);
    // Delete ticket
    await prisma.tierTicket.delete({ where: { id } });

    res.json({ success: true });

}));

/**
 * PUT /api/tier/submissions/:id
 * Edit or review a tier submission
 */
router.put('/submissions/:id', requirePermission('manageTier', 'manageEvents', 'manageSettings'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const id = String(req.params.id);
    const { status, reviewerComment, mpType, clipUrl } = req.body;

    const submission = await prisma.tierSubmission.findUnique({ where: { id } });
    if (!submission) return res.status(404).json({ error: 'Откат не найден' });

    const updated = await prisma.tierSubmission.update({
        where: { id },
        data: {
            ...(status ? { status } : {}),
            ...(reviewerComment !== undefined ? { reviewerComment } : {}),
            ...(mpType ? { mpType } : {}),
            ...(clipUrl ? { clipUrl } : {}),
        },
    });

    res.json({ submission: updated });

}));

/**
 * DELETE /api/tier/submissions/:id
 * Delete a single submission (fake/rofl clip)
 */
router.delete('/submissions/:id', requirePermission('manageTier', 'manageEvents', 'manageSettings'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const id = String(req.params.id);
    const submission = await prisma.tierSubmission.findUnique({ where: { id } });
    if (!submission) return res.status(404).json({ error: 'Откат не найден' });

    await prisma.tierSubmission.delete({ where: { id } });
    res.json({ success: true });

}));

export default router;
