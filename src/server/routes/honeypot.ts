import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import prisma from '../../database/client';
import honeypotManager from '../../bot/modules/honeypot/honeypotManager';
import bot from '../../bot/client';
import appConfig from '../../config';
import { resolveGuildId, getDiscordGuild } from '../utils/guild';
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireGuildId } from "../middlewares/requireGuildId";
import { requireBot } from "../middlewares/requireBot";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/honeypot
 * Retrieve honeypot config, statistics, and recent caught spam logs
 */
router.get('/', requireGuildId, requireBot, asyncHandler(async (req, res) => {

    const config = await honeypotManager.getConfig();

    const [recentLogs, totalLogs] = await Promise.all([
        prisma.honeypotLog.findMany({
            orderBy: { caughtAt: 'desc' },
            take: 50,
        }),
        prisma.honeypotLog.count(),
    ]);

    // Auto-discover channel if not set
    if (!config.channelId && ((req as any).botClient as import('discord.js').Client).isReady() && ((req as any).botClient as import('discord.js').Client).guilds.cache.size > 0) {
        for (const g of ((req as any).botClient as import('discord.js').Client).guilds.cache.values()) {
            try {
                const chs = await g.channels.fetch().catch(() => null);
                const channelList = chs ? Array.from(chs.values()) : Array.from(g.channels.cache.values());
                const targetName = (config.channelName || 'канал-ловушка').toLowerCase();
                const found = channelList.find(
                    (c: any) =>
                        c &&
                        (c.name?.toLowerCase() === targetName ||
                            c.name?.toLowerCase() === 'канал-ловушка') &&
                        (c.type === 0 || Number(c.type) === 0)
                );
                if (found) {
                    config.channelId = found.id;
                    config.guildId = g.id;
                    config.channelName = found.name;
                    await prisma.honeypotConfig.update({
                        where: { id: 'default' },
                        data: { guildId: g.id, channelId: found.id, channelName: found.name },
                    }).catch(() => { });
                    break;
                }
            } catch { }
        }
    }

    let channelDetails: any = null;
    if (config.channelId && ((req as any).botClient as import('discord.js').Client).isReady()) {
        let ch = ((req as any).botClient as import('discord.js').Client).channels.cache.get(config.channelId);
        if (!ch) {
            ch = (await ((req as any).botClient as import('discord.js').Client).channels.fetch(config.channelId).catch(() => null)) as any;
        }
        if (ch) {
            channelDetails = {
                id: ch.id,
                name: (ch as any).name,
                guildId: (ch as any).guildId,
            };
        }
    }

    const requestedGuildId = (req.query.guildId as string) || (req.headers['x-guild-id'] as string) || resolveGuildId(req as AuthenticatedRequest) || config.guildId;
    let guild = requestedGuildId ? await getDiscordGuild(requestedGuildId) : null;

    if (!guild && config.guildId) {
        guild = await getDiscordGuild(config.guildId);
    }
    if (!guild && appConfig.discord.guildId) {
        guild = await getDiscordGuild(appConfig.discord.guildId);
    }
    if (!guild && ((req as any).botClient as import('discord.js').Client).guilds.cache.size > 0) {
        guild = ((req as any).botClient as import('discord.js').Client).guilds.cache.first() || null;
    }

    let channels: any[] = [];
    let roles: any[] = [];

    if (guild) {
        if (guild.channels.cache.size === 0) {
            await guild.channels.fetch().catch(() => null);
        }
        try {
            const fetchedChannels = await guild.channels.fetch();
            channels = Array.from(fetchedChannels.values())
                .filter((c): c is any => c !== null)
                .map((c) => ({
                    id: c.id,
                    name: c.name,
                    type: Number(c.type),
                    parentId: c.parentId,
                }));
        } catch (err: any) {
            console.warn('⚠️ [Honeypot] Channel fetch error, fallback to cache:', err?.message);
            channels = Array.from(guild.channels.cache.values()).map((c) => ({
                id: c.id,
                name: c.name,
                type: Number(c.type),
                parentId: c.parentId,
            }));
        }

        if (guild.roles.cache.size <= 1) {
            await guild.roles.fetch().catch(() => null);
        }
        roles = Array.from(guild.roles.cache.values())
            .filter((r) => r.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .map((r) => ({
                id: r.id,
                name: r.name,
                color: r.color,
                position: r.position,
            }));
    }

    // Safety fallback: if channels is STILL empty, aggregate from any connected guild
    if (channels.length === 0 && ((req as any).botClient as import('discord.js').Client).guilds.cache.size > 0) {
        for (const g of ((req as any).botClient as import('discord.js').Client).guilds.cache.values()) {
            try {
                const gChs = await g.channels.fetch().catch(() => g.channels.cache);
                for (const c of gChs.values()) {
                    if (c) {
                        channels.push({
                            id: c.id,
                            name: c.name,
                            type: Number(c.type),
                            parentId: c.parentId,
                        });
                    }
                }
                if (channels.length > 0) {
                    if (!guild) guild = g;
                    break;
                }
            } catch {
                // ignore
            }
        }
    }

    const guilds = Array.from(((req as any).botClient as import('discord.js').Client).guilds.cache.values()).map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.iconURL(),
    }));

    res.json({
        config,
        channelDetails,
        recentLogs,
        totalLogs,
        channels,
        roles,
        guilds,
        selectedGuildId: guild?.id || null,
        isBotOnline: ((req as any).botClient as import('discord.js').Client).isReady(),
    });

}));

/**
 * PUT /api/honeypot
 * Save honeypot configuration
 */
router.put('/', requirePermission('manageSettings'), requireGuildId, requireBot, asyncHandler(async (req, res) => {

    const {
        enabled,
        action,
        channelId,
        channelName,
        deleteSeconds,
        whitelistRoles,
        embedTitle,
        embedDescription,
        guildId,
    } = req.body;

    const whitelistStr = Array.isArray(whitelistRoles)
        ? JSON.stringify(whitelistRoles)
        : typeof whitelistRoles === 'string'
            ? whitelistRoles
            : '[]';

    const cleanChannelId = channelId ? String(channelId).trim() : null;
    let resolvedName = channelName || 'канал-ловушка';
    let resolvedGuildId = guildId || (req.headers['x-guild-id'] as string) || resolveGuildId(req as AuthenticatedRequest);

    if (cleanChannelId && ((req as any).botClient as import('discord.js').Client).isReady()) {
        const ch = ((req as any).botClient as import('discord.js').Client).channels.cache.get(cleanChannelId) || await ((req as any).botClient as import('discord.js').Client).channels.fetch(cleanChannelId).catch(() => null);
        if (ch) {
            if ((ch as any).name) resolvedName = (ch as any).name;
            if ((ch as any).guildId) resolvedGuildId = (ch as any).guildId;
        }
    }

    const updated = await prisma.honeypotConfig.upsert({
        where: { id: 'default' },
        update: {
            guildId: resolvedGuildId || undefined,
            enabled: typeof enabled === 'boolean' ? enabled : true,
            action: action === 'BAN' ? 'BAN' : 'KICK',
            channelId: cleanChannelId,
            channelName: resolvedName,
            deleteSeconds: Number(deleteSeconds) || 600,
            whitelistRoles: whitelistStr,
            embedTitle: embedTitle || '🛡️ Канал-ловушка автомодерации',
            embedDescription: embedDescription || '⚠️ **НЕ ПИШИТЕ СООБЩЕНИЯ В ЭТОТ КАНАЛ**\n\nЭтот канал используется для выявления спам-ботов.\nЛюбое сообщение здесь приведёт к немедленной блокировке.',
        },
        create: {
            id: 'default',
            guildId: resolvedGuildId || undefined,
            enabled: typeof enabled === 'boolean' ? enabled : true,
            action: action === 'BAN' ? 'BAN' : 'KICK',
            channelId: cleanChannelId,
            channelName: resolvedName,
            deleteSeconds: Number(deleteSeconds) || 600,
            whitelistRoles: whitelistStr,
            embedTitle: embedTitle || '🛡️ Канал-ловушка автомодерации',
            embedDescription: embedDescription || '⚠️ **НЕ ПИШИТЕ СООБЩЕНИЯ В ЭТОТ КАНАЛ**\n\nЭтот канал используется для выявления спам-ботов.\nЛюбое сообщение здесь приведёт к немедленной блокировке.',
        },
    });

    // Refresh warning message if channel and message are configured
    if (updated.channelId && updated.messageId) {
        await honeypotManager.refreshWarningMessage().catch(() => null);
    }

    res.json({ success: true, config: updated });

}));

/**
 * POST /api/honeypot/send-embed
 * Send warning embed directly into the selected channel and pin it
 */
router.post('/send-embed', requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req, res) => {

    const targetChannelId = req.body.channelId;
    if (!targetChannelId || !String(targetChannelId).trim()) {
        return res.status(400).json({ error: 'Пожалуйста, выберите канал или введите его ID' });
    }
    const targetGuildId = req.body.guildId || (req.headers['x-guild-id'] as string) || resolveGuildId(req as AuthenticatedRequest);
    const result = await honeypotManager.sendEmbedToChannel(String(targetChannelId).trim(), targetGuildId);
    res.json(result);

}));

/**
 * POST /api/honeypot/setup-channel
 * Automatically create or re-provision the trap channel on Discord
 */
router.post('/setup-channel', requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req, res) => {

    const targetGuildId = req.body.guildId || (req.headers['x-guild-id'] as string) || resolveGuildId(req as AuthenticatedRequest);
    const result = await honeypotManager.setupChannel(targetGuildId);
    res.json(result);

}));

/**
 * POST /api/honeypot/refresh-embed
 * Refresh embed message in channel
 */
router.post('/refresh-embed', requirePermission('manageSettings'), asyncHandler(async (req, res) => {

    await honeypotManager.refreshWarningMessage();
    res.json({ success: true, message: 'Сообщение в канале обновлено' });

}));

/**
 * POST /api/honeypot/reset-counter
 * Reset the caught counter
 */
router.post('/reset-counter', requirePermission('manageSettings'), asyncHandler(async (req, res) => {

    const updated = await prisma.honeypotConfig.update({
        where: { id: 'default' },
        data: { totalCaught: 0 },
    });
    await honeypotManager.refreshWarningMessage();
    res.json({ success: true, totalCaught: updated.totalCaught });

}));

/**
 * DELETE /api/honeypot/logs
 * Clear log history
 */
router.delete('/logs', requirePermission('manageSettings'), asyncHandler(async (req, res) => {

    await prisma.honeypotLog.deleteMany({});
    res.json({ success: true, message: 'История логов очищена' });

}));

export default router;
