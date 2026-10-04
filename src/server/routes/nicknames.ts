import { Router, Response } from 'express';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { getDiscordGuild } from '../utils/guild';
import { NicknameService } from '../../bot/modules/nicknames/nicknameService';
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireGuildId } from "../middlewares/requireGuildId";

export const nicknamesRouter = Router();

nicknamesRouter.use(requireAuth);

/**
 * GET /api/nicknames/config
 * Get configuration, role bindings, and discord roles
 */
nicknamesRouter.get('/config', requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const config = await NicknameService.getConfig(guildId);

    const bindings = await prisma.roleNicknameBinding.findMany({
        where: { guildId },
        orderBy: { priority: 'desc' },
    });

    const guild = await getDiscordGuild(guildId);
    const roles = guild ? guild.roles.cache
        .filter(r => r.name !== '@everyone')
        .map(r => ({
            id: r.id,
            name: r.name,
            color: r.hexColor,
            position: r.position,
        }))
        .sort((a, b) => b.position - a.position) : [];

    return res.json({ config, bindings, roles });

}));

/**
 * POST /api/nicknames/config
 * Update general auto-nickname settings
 */
nicknamesRouter.post('/config', requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const { enabled, defaultFormat, defaultPrefix, fallbackFormat } = req.body;

    const config = await prisma.nicknameConfig.upsert({
        where: { guildId },
        update: {
            enabled: typeof enabled === 'boolean' ? enabled : true,
            defaultFormat: defaultFormat || '{prefix} | {name} | {static}',
            defaultPrefix: defaultPrefix || '1',
            fallbackFormat: fallbackFormat || '{name} | {static}',
        },
        create: {
            guildId,
            enabled: typeof enabled === 'boolean' ? enabled : true,
            defaultFormat: defaultFormat || '{prefix} | {name} | {static}',
            defaultPrefix: defaultPrefix || '1',
            fallbackFormat: fallbackFormat || '{name} | {static}',
        },
    });

    return res.json({ success: true, config });

}));

/**
 * POST /api/nicknames/bindings
 * Create or update a role nickname binding
 */
nicknamesRouter.post('/bindings', requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const { id, roleId, prefix, format, priority } = req.body;

    if (!roleId || !prefix) {
        return res.status(400).json({ error: 'Выберите роль и укажите префикс' });
    }

    const guild = await getDiscordGuild(guildId);
    const role = guild?.roles.cache.get(roleId);
    const roleName = role ? role.name : null;

    let binding;
    if (id) {
        binding = await prisma.roleNicknameBinding.update({
            where: { id },
            data: {
                roleId,
                roleName: roleName || undefined,
                prefix: String(prefix).trim(),
                format: format || '{prefix} | {name} | {static}',
                priority: parseInt(priority, 10) || 0,
            },
        });
    } else {
        binding = await prisma.roleNicknameBinding.upsert({
            where: {
                guildId_roleId: { guildId, roleId },
            },
            update: {
                roleName: roleName || undefined,
                prefix: String(prefix).trim(),
                format: format || '{prefix} | {name} | {static}',
                priority: parseInt(priority, 10) || 0,
            },
            create: {
                guildId,
                roleId,
                roleName,
                prefix: String(prefix).trim(),
                format: format || '{prefix} | {name} | {static}',
                priority: parseInt(priority, 10) || 0,
            },
        });
    }

    return res.json({ success: true, binding });

}));

/**
 * DELETE /api/nicknames/bindings/:id
 * Delete a role nickname binding
 */
nicknamesRouter.delete('/bindings/:id', requirePermission('manageSettings'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const id = req.params.id as string;
    await prisma.roleNicknameBinding.delete({
        where: { id },
    });
    return res.json({ success: true });

}));

/**
 * GET /api/nicknames/locks
 * List all members with manual nickname locks
 */
nicknamesRouter.get('/locks', requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const guild = await getDiscordGuild(guildId);

    const locks = await prisma.manualNicknameLock.findMany({
        where: { guildId },
        orderBy: { updatedAt: 'desc' },
    });

    const enriched = await Promise.all(
        locks.map(async (lock: any) => {
            let avatarUrl: string | null = null;
            let displayName = lock.userTag || lock.userId;
            let currentNick: string | null = null;

            if (guild) {
                const member = guild.members.cache.get(lock.userId) || await guild.members.fetch(lock.userId).catch(() => null);
                if (member) {
                    displayName = member.displayName || member.user.username;
                    currentNick = member.nickname || null;
                    avatarUrl = member.user.displayAvatarURL({ size: 64 });
                }
            }

            return {
                id: lock.id,
                userId: lock.userId,
                userTag: lock.userTag,
                displayName,
                currentNick,
                avatarUrl,
                nickname: lock.nickname,
                lockedBy: lock.lockedBy,
                createdAt: lock.createdAt,
                updatedAt: lock.updatedAt,
            };
        })
    );

    return res.json({ locks: enriched });

}));

/**
 * DELETE /api/nicknames/locks/:userId
 * Remove manual nickname lock for a member
 */
nicknamesRouter.delete('/locks/:userId', requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const userId = req.params.userId as string;

    await prisma.manualNicknameLock.deleteMany({
        where: { guildId, userId },
    });

    return res.json({ success: true });

}));

/**
 * POST /api/nicknames/sync/:userId
 * Auto-sync a single user's nickname based on their roles and main character
 */
nicknamesRouter.post('/sync/:userId', requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const userId = req.params.userId as string;
    const force = req.query.force === 'true' || req.body?.force === true;

    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(400).json({ error: 'Сервер Discord недоступен' });

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Участник не найден на сервере' });

    const result = await NicknameService.syncMemberNickname(
        member,
        `Синхронизация через сайт (${req.user!.username})`,
        force
    );

    return res.json({ success: true, result });

}));

/**
 * POST /api/nicknames/manual/:userId
 * Manually set a custom nickname for a user in Discord
 */
nicknamesRouter.post('/manual/:userId', requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const userId = req.params.userId as string;
    const { nickname } = req.body;

    if (!nickname || typeof nickname !== 'string' || nickname.trim() === '') {
        return res.status(400).json({ error: 'Укажите новый никнейм' });
    }

    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(400).json({ error: 'Сервер Discord недоступен' });

    const result = await NicknameService.manualSetNickname(
        guild,
        userId,
        nickname,
        req.user!.username
    );

    if (!result.success) {
        return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true, nickname: nickname.trim().substring(0, 32) });

}));

/**
 * POST /api/nicknames/sync-all
 * Batch synchronize all guild members
 */
nicknamesRouter.post('/sync-all', requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(400).json({ error: 'Сервер Discord недоступен' });

    const stats = await NicknameService.syncAllGuildMembers(guild);

    return res.json({ success: true, stats });

}));

export default nicknamesRouter;
