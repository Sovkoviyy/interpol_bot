import { Router, Response } from 'express';
import { TextChannel } from 'discord.js';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { ProfileService } from '../../bot/modules/profiles/profileService';
import { ServerSetupService } from '../../bot/modules/setup/serverSetupService';
import { AuditLogger } from '../../bot/modules/logging/auditLogger';
import { BotMessageManager } from '../../bot/utils/botMessageManager';
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireGuildId } from "../middlewares/requireGuildId";
import { requireBot } from "../middlewares/requireBot";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/profiles
 * List profiles with search, sorting, and aggregate statistics
 */
router.get('/', requirePermission('manageProfiles', 'manageRecruiting', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const search = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || 'mpCount';
    const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

    // Allowable sort fields
    const validSortFields = ['mpCount', 'voiceSeconds', 'penaltyMp', 'rank', 'createdAt', 'userTag'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'mpCount';

    let profiles = search
        ? await ProfileService.searchProfiles(guildId, search)
        : await prisma.userProfile.findMany({
            where: { guildId },
            orderBy: { [orderByField]: order },
            include: { characters: { orderBy: { createdAt: 'asc' } } },
            take: 100,
        });

    if (search && orderByField) {
        // Sort in-memory if search results
        profiles.sort((a: any, b: any) => {
            const valA = a[orderByField] ?? 0;
            const valB = b[orderByField] ?? 0;
            if (order === 'asc') return valA > valB ? 1 : -1;
            return valA < valB ? 1 : -1;
        });
    }

    // Stats
    const totalCount = await prisma.userProfile.count({ where: { guildId } });
    const withStatics = await prisma.userProfile.count({
        where: {
            guildId,
            staticId: { not: null },
        },
    });
    const withoutStatics = totalCount - withStatics;
    const activeCount = await prisma.userProfile.count({
        where: { guildId, status: 'ACTIVE' },
    });
    const onLeaveCount = await prisma.userProfile.count({
        where: { guildId, status: 'ON_LEAVE' },
    });

    res.json({
        profiles,
        totalCount,
        stats: {
            total: totalCount,
            withStatics,
            withoutStatics,
            active: activeCount,
            onLeave: onLeaveCount,
        },
    });

}));

/**
 * GET /api/profiles/leaderboard
 */
router.get('/leaderboard', requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const topMp = await prisma.userProfile.findMany({
        where: { guildId },
        orderBy: { mpCount: 'desc' },
        include: { characters: { orderBy: { createdAt: 'asc' } } },
        take: 10,
    });
    const topVoice = await prisma.userProfile.findMany({
        where: { guildId },
        orderBy: { voiceSeconds: 'desc' },
        include: { characters: { orderBy: { createdAt: 'asc' } } },
        take: 10,
    });

    res.json({ topMp, topVoice });

}));

/**
 * POST /api/profiles/manual
 * Manually create or update member profile with up to 3 characters
 */
router.post('/manual', requirePermission('manageProfiles', 'manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const { userId, userTag, rank, notes, status, characters } = req.body;

    if (!userId || String(userId).trim() === '') {
        return res.status(400).json({ error: 'Укажите Discord User ID' });
    }

    const cleanUserId = String(userId).trim();
    const cleanUserTag = userTag?.trim() || `User_${cleanUserId.slice(-4)}`;

    // Ensure profile exists
    let profile = await prisma.userProfile.upsert({
        where: { guildId_userId: { guildId, userId: cleanUserId } },
        create: {
            guildId,
            userId: cleanUserId,
            userTag: cleanUserTag,
            rank: parseInt(rank, 10) || 1,
            status: status || 'ACTIVE',
            notes: notes || null,
        },
        update: {
            userTag: cleanUserTag,
            ...(rank !== undefined ? { rank: parseInt(rank, 10) } : {}),
            ...(status ? { status } : {}),
            ...(notes !== undefined ? { notes } : {}),
        },
    });


    // Sync characters if provided
    let updatedProfile = profile;
    if (Array.isArray(characters)) {
        updatedProfile = await ProfileService.syncCharacters(guildId, cleanUserId, characters);
    }

    // Record audit log
    await AuditLogger.recordEntry({
        guildId,
        category: 'PROFILES',
        action: 'PROFILE_MANUAL_UPSERT',
        title: 'Вручную обновлен профиль участника',
        description: `Администратор <@${req.user!.userId}> внес данные профиля для <@${cleanUserId}> (${cleanUserTag})`,
        executorId: req.user!.userId,
        executorTag: req.user!.username,
        targetId: cleanUserId,
        targetTag: cleanUserTag,
    });

    res.json({ success: true, profile: updatedProfile });

}));

/**
 * GET /api/profiles/:userId
 */
router.get('/:userId', requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const profile = await ProfileService.getOrCreateProfile(guildId, String(req.params.userId));
    res.json({ profile });

}));

/**
 * POST /api/profiles/:userId/static
 */
router.post('/:userId/static', requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const authUser = req.user;
    const targetUserId = String(req.params.userId);
    const isSelf = authUser?.userId === targetUserId;
    const hasPerm = authUser?.permissions.isAdmin || authUser?.permissions.manageSettings || authUser?.permissions.manageRecruiting;

    if (!isSelf && !hasPerm) {
        return res.status(403).json({ error: 'Forbidden: You cannot modify another member\'s profile' });
    }

    const guildId = (req as any).guildId;
    const { staticId, characterName, isMain } = req.body;
    if (!staticId) return res.status(400).json({ error: 'Укажите Static ID' });

    const updated = await ProfileService.setStatic(
        guildId,
        targetUserId,
        staticId,
        characterName,
        undefined,
        isMain !== false
    );

    res.json({ profile: updated });

}));

/**
 * POST /api/profiles/:userId/characters
 * Set/update up to 3 characters for user
 */
router.post('/:userId/characters', requirePermission('manageProfiles', 'manageRecruiting'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const targetUserId = String(req.params.userId);
    const { characters } = req.body;

    if (!Array.isArray(characters)) {
        return res.status(400).json({ error: 'characters must be an array' });
    }

    const updated = await ProfileService.syncCharacters(guildId, targetUserId, characters);
    res.json({ profile: updated });

}));

/**
 * POST /api/profiles/:userId/set-main
 * Set primary character
 */
router.post('/:userId/set-main', requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const authUser = req.user;
    const targetUserId = String(req.params.userId);
    const isSelf = authUser?.userId === targetUserId;
    const hasPerm = authUser?.permissions.isAdmin || authUser?.permissions.manageSettings || authUser?.permissions.manageRecruiting;

    if (!isSelf && !hasPerm) {
        return res.status(403).json({ error: 'Forbidden: You cannot modify another member\'s profile' });
    }

    const guildId = (req as any).guildId;
    const { staticOrCharId } = req.body;

    if (!staticOrCharId) return res.status(400).json({ error: 'Укажите staticId или characterId' });

    const updated = await ProfileService.setMainCharacter(guildId, targetUserId, staticOrCharId);
    res.json({ profile: updated });

}));

/**
 * POST /api/profiles/:userId/penalty
 * Add penalty MPs
 */
router.post('/:userId/penalty', requirePermission('manageProfiles', 'manageRecruiting'), requireGuildId, requireBot, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const { count, reason } = req.body;
    const penaltyCount = parseInt(count, 10) || 1;

    const updated = await ProfileService.addPenaltyMp(
        guildId,
        String(req.params.userId),
        penaltyCount,
        reason
    );

    await AuditLogger.recordEntry({
        guildId,
        category: 'PROFILES',
        action: 'PENALTY_ADD',
        title: 'Выписаны штрафные МП',
        description: `Рекрутер <@${req.user!.userId}> начислил +${penaltyCount} штрафных МП для <@${req.params.userId}>. Причина: ${reason || 'Без причины'}`,
        executorId: req.user!.userId,
        executorTag: req.user!.username,
        targetId: String(req.params.userId),
    });

    const guild = ((req as any).botClient as import('discord.js').Client).guilds.cache.get(guildId) || await ((req as any).botClient as import('discord.js').Client).guilds.fetch(guildId).catch(() => null);
    if (guild) {
        BotMessageManager.sendDM(guildId, String(req.params.userId), 'sanction_dm_warn', {
            user: `<@${req.params.userId}>`,
            username: updated.userTag || String(req.params.userId),
            moderator: req.user!.username,
            reason: reason || 'Нарушение дисциплины / штрафные МП',
            warnCount: String(updated.penaltyMp),
            maxWarns: '10',
            guild: guild.name,
        }).catch(() => null);

        const renderedWarn = await BotMessageManager.renderMessage(guildId, 'sanction_warn_channel', {
            user: `<@${req.params.userId}>`,
            username: updated.userTag || String(req.params.userId),
            moderator: `<@${req.user!.userId}>`,
            reason: reason || 'Нарушение дисциплины / штрафные МП',
            warnCount: String(updated.penaltyMp),
            maxWarns: '10',
            guild: guild.name,
        });
        if (renderedWarn.enabled) {
            await AuditLogger.sendLog(guild, 'MEMBERS', renderedWarn.embed).catch(() => null);
        }
    }

    res.json({ profile: updated });

}));

/**
 * POST /api/profiles/:userId/penalty/remove
 * Remove penalty MPs
 */
router.post('/:userId/penalty/remove', requirePermission('manageProfiles', 'manageRecruiting'), requireGuildId, requireBot, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const { count, reason } = req.body;
    const penaltyCount = parseInt(count, 10) || 1;

    const updated = await ProfileService.removePenaltyMp(
        guildId,
        String(req.params.userId),
        penaltyCount,
        reason
    );

    await AuditLogger.recordEntry({
        guildId,
        category: 'PROFILES',
        action: 'PENALTY_REMOVE',
        title: 'Сняты штрафные МП',
        description: `Рекрутер <@${req.user!.userId}> снял ${penaltyCount} штрафных МП для <@${req.params.userId}>. Причина: ${reason || 'Отработка'}`,
        executorId: req.user!.userId,
        executorTag: req.user!.username,
        targetId: String(req.params.userId),
    });

    const guild = ((req as any).botClient as import('discord.js').Client).guilds.cache.get(guildId) || await ((req as any).botClient as import('discord.js').Client).guilds.fetch(guildId).catch(() => null);
    if (guild) {
        BotMessageManager.sendDM(guildId, String(req.params.userId), 'sanction_dm_unwarn', {
            user: `<@${req.params.userId}>`,
            username: updated.userTag || String(req.params.userId),
            moderator: req.user!.username,
            warnCount: String(updated.penaltyMp),
            maxWarns: '10',
            guild: guild.name,
        }).catch(() => null);
    }

    res.json({ profile: updated });

}));

/**
 * POST /api/profiles/deploy-panel
 * Send interactive static binding message to Discord channel
 */
router.post('/deploy-panel', requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Укажите ID текстового канала' });

    const guildId = (req as any).guildId;


    const result = await ServerSetupService.deployPanel(guildId, 'static', channelId);
    res.json(result);

}));

export default router;
