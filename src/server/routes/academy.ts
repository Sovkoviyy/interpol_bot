import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';

import bot from '../../bot/client';
import { AcademyService } from '../../bot/modules/academy/academyService';
import { AuditLogger } from '../../bot/modules/logging/auditLogger';
import { PayrollService } from '../../bot/modules/payroll/payrollService';
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
    const channels = await AcademyService.getChannels(guildId);

    const week = PayrollService.getWeekRange(new Date());
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const weekStartMs = week.start.getTime();
    const sevenDaysAgoMs = sevenDaysAgo.getTime();

    const enrichedChannels = channels.map(ch => {
        const reports = ch.reports || [];
        const reportsThisWeek = reports.filter(r => new Date(r.createdAt).getTime() >= weekStartMs).length;
        const reportsLast7Days = reports.filter(r => new Date(r.createdAt).getTime() >= sevenDaysAgoMs).length;
        const lastReportAt = reports.length > 0 ? reports[0].createdAt : null;

        // Reference date is latest report date or channel creation date
        const refDate = lastReportAt ? new Date(lastReportAt) : new Date(ch.createdAt);
        const daysWithoutReports = Math.max(0, Math.floor((Date.now() - refDate.getTime()) / (24 * 3600 * 1000)));

        // Academician is inactive if status is ACTIVE and no reports for 7 or more days (since last report or since joining)
        const isInactiveWeek = ch.status === 'ACTIVE' && daysWithoutReports >= 7;

        return {
            ...ch,
            reportsThisWeek,
            reportsLast7Days,
            lastReportAt,
            daysWithoutReports,
            isInactiveWeek,
        };
    });

    res.json({
        channels: enrichedChannels,
        weekStart: week.start,
        weekEnd: week.end,
    });

}));

/**
 * GET /api/academy/reports
 */
router.get('/reports', requirePermission('manageAcademy', 'manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const status = req.query.status as string;

    const reports = await AcademyService.getReports(guildId, status);

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
router.put('/channels/:id', requirePermission('manageAcademy', 'manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const id = String(req.params.id);
    const { staticId, approvedMpCount, requiredMp, penaltyMp, status } = req.body;

    const existing = await AcademyService.getChannelById(id);
    if (!existing || existing.guildId !== guildId) return res.status(404).json({ error: 'Профиль ученика не найден' });

    const updated = await AcademyService.updateChannel(guildId, id, req.body);

    res.json({ channel: updated });

}));

/**
 * POST /api/academy/channels/expel-inactive
 * Expel all inactive academicians (no reports for 7+ days)
 */
router.post('/channels/expel-inactive', requirePermission('manageAcademy', 'manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const { channelIds } = req.body;

    const inactive = await AcademyService.getInactiveChannels(guildId, channelIds);

    const userTag = req.user?.username || (req.user as any)?.tag;
    const userId = req.user?.userId || (req.user as any)?.id;

    let expelledCount = 0;
    for (const ch of inactive) {
        try {
            await AcademyService.expelAcademician(
                guildId,
                ch.id,
                { id: userId, tag: userTag },
                'Исключение за неактивность (нет отчетов 7+ дней)'
            );
            expelledCount++;
        } catch (e) {
            console.error(`[Academy] Error expelling inactive student ${ch.id}:`, e);
        }
    }

    res.json({
        success: true,
        expelledCount,
        message: `Успешно исключено ${expelledCount} неактивных академиков`,
    });
}));

/**
 * DELETE /api/academy/channels/:id
 * Delete an academy student profile (revokes roles, deletes Discord channel, clears DB)
 */
router.delete('/channels/:id', requirePermission('manageAcademy', 'manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const id = String(req.params.id);
    const existing = await AcademyService.getChannelById(id);
    if (!existing) return res.status(404).json({ error: 'Профиль ученика не найден' });

    const userTag = req.user?.username || (req.user as any)?.tag;
    const userId = req.user?.userId || (req.user as any)?.id;

    const result = await AcademyService.expelAcademician(
        guildId,
        id,
        { id: userId, tag: userTag },
        'Удаление профиля через панель управления'
    );

    if (!result.success) {
        return res.status(400).json({ error: result.error || 'Ошибка удаления профиля' });
    }

    res.json({ success: true, message: 'Профиль ученика успешно удален, роли сняты' });
}));

/**
 * DELETE /api/academy/reports/:id
 * Delete a specific report (fake/spam)
 */
router.delete('/reports/:id', requirePermission('manageAcademy', 'manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    const report = await AcademyService.getReportById(id);
    if (!report) return res.status(404).json({ error: 'Отчет не найден' });

    await AcademyService.deleteReport(id);
    res.json({ success: true, message: 'Отчет успешно удален' });
}));

export default router;
