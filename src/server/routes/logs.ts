import { Router, Response } from 'express';
import { AuditLogEvent } from 'discord.js';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { AuditLogger } from '../../bot/modules/logging/auditLogger';
import { getDiscordGuild } from '../utils/guild';
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireGuildId } from "../middlewares/requireGuildId";

export const logsRouter = Router();

// Get logging config
logsRouter.get('/config', requireAuth, requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const logConfig = await prisma.loggingConfig.findUnique({
        where: { guildId },
    });

    const defaultEnabled = ['MESSAGES', 'MEMBERS', 'ROLES', 'CHANNELS', 'VOICE', 'INVITES', 'BOT', 'EVENTS'];

    if (!logConfig) {
        return res.json({
            config: {
                guildId,
                categoryId: null,
                messageLogsChannelId: null,
                memberLogsChannelId: null,
                roleLogsChannelId: null,
                channelLogsChannelId: null,
                voiceLogsChannelId: null,
                inviteLogsChannelId: null,
                botLogsChannelId: null,
                eventLogsChannelId: null,
                enabledLogTypes: defaultEnabled,
            },
        });
    }

    let enabledLogTypes = defaultEnabled;
    try {
        enabledLogTypes = JSON.parse(logConfig.enabledLogTypesJson || '[]');
    } catch {
        enabledLogTypes = defaultEnabled;
    }

    return res.json({
        config: {
            ...logConfig,
            enabledLogTypes,
        },
    });
}));

// Update logging config
logsRouter.post('/config', requireAuth, requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const {
        categoryId,
        messageLogsChannelId,
        memberLogsChannelId,
        roleLogsChannelId,
        channelLogsChannelId,
        voiceLogsChannelId,
        inviteLogsChannelId,
        botLogsChannelId,
        eventLogsChannelId,
        enabledLogTypes,
        logSentMessages,
    } = req.body;

    const updated = await prisma.loggingConfig.upsert({
        where: { guildId },
        update: {
            categoryId,
            messageLogsChannelId,
            memberLogsChannelId,
            roleLogsChannelId,
            channelLogsChannelId,
            voiceLogsChannelId,
            inviteLogsChannelId,
            botLogsChannelId,
            eventLogsChannelId,
            enabledLogTypesJson: JSON.stringify(enabledLogTypes || []),
            logSentMessages: logSentMessages !== undefined ? Boolean(logSentMessages) : true,
        },
        create: {
            guildId,
            categoryId,
            messageLogsChannelId,
            memberLogsChannelId,
            roleLogsChannelId,
            channelLogsChannelId,
            voiceLogsChannelId,
            inviteLogsChannelId,
            botLogsChannelId,
            eventLogsChannelId,
            enabledLogTypesJson: JSON.stringify(enabledLogTypes || []),
            logSentMessages: logSentMessages !== undefined ? Boolean(logSentMessages) : true,
        },
    });

    return res.json({ success: true, config: updated });
}));

// 1-Click Auto Setup channels in Discord
logsRouter.post('/auto-setup', requireAuth, requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const guild = await getDiscordGuild(guildId);

    if (!guild) {
        return res.status(400).json({ error: 'Бот не подключен к серверу Discord' });
    }

    try {
        const result = await AuditLogger.setupLogChannels(guild);
        return res.json({ success: true, result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}));

/**
 * GET /api/logs/entries
 * Returns combined audit logs (Discord server audit logs + internal Bot action logs)
 */
logsRouter.get('/entries', requireAuth, requirePermission('viewLogs', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const actionFilter = (req.query.action as string) || 'ALL';
    const categoryFilter = (req.query.category as string) || 'ALL';
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string, 10) || 100);

    const moderationActions = [
        'MEMBER_TIMEOUT',
        'MEMBER_UNTIMEOUT',
        'MEMBER_KICK',
        'MEMBER_BAN',
        'MEMBER_UNBAN',
        'VOICE_SERVER_MUTE',
        'VOICE_SERVER_UNMUTE',
        'VOICE_SERVER_DEAF',
        'VOICE_SERVER_UNDEAF',
        'VOICE_DISCONNECT_MOD',
        'VOICE_MOVE_MOD',
        'MESSAGE_DELETE_MOD',
        'PENALTY_ADDED',
        'PENALTY_REMOVED',
    ];

    // Build DB query conditions
    const whereClause: any = { guildId };

    if (actionFilter !== 'ALL') {
        whereClause.action = actionFilter;
    } else if (categoryFilter === 'MODERATION') {
        whereClause.OR = [
            { action: { in: moderationActions } },
            { category: 'MODERATION' },
        ];
    } else if (categoryFilter !== 'ALL') {
        whereClause.category = categoryFilter;
    }

    // 1. Fetch DB Bot Logs
    const dbLogs = await prisma.auditLogEntry.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 300,
    });

    const formattedBotLogs = dbLogs.map((log) => {
        let meta: any = {};
        try {
            meta = JSON.parse(log.metadataJson || '{}');
        } catch {}

        return {
            id: log.id,
            source: 'BOT',
            category: log.category,
            action: log.action,
            executorId: log.executorId,
            executorTag: log.executorTag || log.executorId || 'Система',
            targetId: log.targetId,
            targetTag: log.targetTag || null,
            details: log.description || log.title,
            title: log.title,
            metadata: meta,
            createdAt: log.createdAt,
        };
    });

    // 2. Fetch Native Discord Audit Logs
    const guild = await getDiscordGuild(guildId);
    const discordLogs: any[] = [];

    if (guild) {
        try {
            const audit = await guild.fetchAuditLogs({ limit: 100 });
            for (const entry of audit.entries.values()) {
                let actionName = 'DISCORD_ACTION';
                let category = 'DISCORD';
                let details = '';
                const extra = entry.extra as any;
                const reason = entry.reason || '';

                // Determine action type from Discord AuditLogEvent
                const actionType = entry.action as any;
                if (actionType === AuditLogEvent.ChannelCreate) {
                    actionName = 'CHANNEL_CREATE';
                    category = 'CHANNELS';
                    details = `Создан канал: #${(entry.target as any)?.name || entry.targetId}`;
                } else if (actionType === AuditLogEvent.ChannelDelete) {
                    actionName = 'CHANNEL_DELETE';
                    category = 'CHANNELS';
                    details = `Удален канал: #${(entry.target as any)?.name || entry.targetId}`;
                } else if (actionType === AuditLogEvent.ChannelUpdate) {
                    actionName = 'CHANNEL_UPDATE';
                    category = 'CHANNELS';
                    details = `Изменен канал: #${(entry.target as any)?.name || entry.targetId}`;
                } else if (actionType === 20 || actionType === AuditLogEvent.MemberKick) {
                    actionName = 'MEMBER_KICK';
                    category = 'MEMBERS';
                    details = `Кикнут участник: ${(entry.target as any)?.tag || (entry.target as any)?.username || entry.targetId}${reason ? `. Причина: ${reason}` : ''}`;
                } else if (actionType === 22 || actionType === AuditLogEvent.MemberBanAdd) {
                    actionName = 'MEMBER_BAN';
                    category = 'MEMBERS';
                    details = `Забанен участник: ${(entry.target as any)?.tag || (entry.target as any)?.username || entry.targetId}${reason ? `. Причина: ${reason}` : ''}`;
                } else if (actionType === 23 || actionType === AuditLogEvent.MemberBanRemove) {
                    actionName = 'MEMBER_UNBAN';
                    category = 'MEMBERS';
                    details = `Разбанен участник: ${(entry.target as any)?.tag || (entry.target as any)?.username || entry.targetId}`;
                } else if (actionType === 24 || actionType === AuditLogEvent.MemberUpdate) {
                    const timeoutChange = entry.changes?.find(c => c.key === 'communication_disabled_until');
                    const nickChange = entry.changes?.find(c => c.key === 'nick');
                    const muteChange = entry.changes?.find(c => c.key === 'mute');
                    const deafChange = entry.changes?.find(c => c.key === 'deaf');

                    if (timeoutChange) {
                        const isMuted = Boolean(timeoutChange.new);
                        actionName = isMuted ? 'MEMBER_TIMEOUT' : 'MEMBER_UNTIMEOUT';
                        category = 'MEMBERS';
                        details = isMuted
                            ? `Тайм-аут (мут) участнику ${(entry.target as any)?.tag || entry.targetId}${reason ? `. Причина: ${reason}` : ''}`
                            : `Снят тайм-аут с участника ${(entry.target as any)?.tag || entry.targetId}`;
                    } else if (muteChange) {
                        actionName = muteChange.new ? 'VOICE_SERVER_MUTE' : 'VOICE_SERVER_UNMUTE';
                        category = 'VOICE';
                        details = `Серверный мут микрофона ${muteChange.new ? 'выдан' : 'снят'} для ${(entry.target as any)?.tag || entry.targetId}`;
                    } else if (deafChange) {
                        actionName = deafChange.new ? 'VOICE_SERVER_DEAF' : 'VOICE_SERVER_UNDEAF';
                        category = 'VOICE';
                        details = `Серверный деф (отключение звука) ${deafChange.new ? 'выдан' : 'снят'} для ${(entry.target as any)?.tag || entry.targetId}`;
                    } else if (nickChange) {
                        actionName = 'MEMBER_NICKNAME_UPDATE';
                        category = 'MEMBERS';
                        details = `Никнейм изменен: «${nickChange.old || '—'}» ➔ «${nickChange.new || '—'}»`;
                    } else {
                        actionName = 'MEMBER_UPDATE';
                        category = 'MEMBERS';
                        details = `Обновление данных участника ${(entry.target as any)?.tag || entry.targetId}`;
                    }
                } else if (actionType === 25 || actionType === AuditLogEvent.MemberRoleUpdate) {
                    actionName = 'MEMBER_ROLES_UPDATE';
                    category = 'ROLES';
                    const changes = entry.changes?.map(c => `${c.key === '$add' ? 'Выдано' : 'Снято'}: ${Array.isArray(c.new) ? c.new.map((r: any) => r.name || r.id).join(', ') : ''}`).join(' | ') || '';
                    details = `Изменение ролей участника ${(entry.target as any)?.tag || entry.targetId}: ${changes}`;
                } else if (actionType === 26 || actionType === AuditLogEvent.MemberMove) {
                    actionName = 'VOICE_MOVE_MOD';
                    category = 'VOICE';
                    details = `Участник ${(entry.target as any)?.tag || entry.targetId} перемещен в войс #${extra?.channel?.name || extra?.channel?.id || ''}`;
                } else if (actionType === 27 || actionType === AuditLogEvent.MemberDisconnect) {
                    actionName = 'VOICE_DISCONNECT_MOD';
                    category = 'VOICE';
                    details = `Участник ${(entry.target as any)?.tag || entry.targetId} принудительно отключен из войса`;
                } else if (actionType === 30 || actionType === AuditLogEvent.RoleCreate) {
                    actionName = 'ROLE_CREATE';
                    category = 'ROLES';
                    details = `Создана роль: @${(entry.target as any)?.name || entry.targetId}`;
                } else if (actionType === 31 || actionType === AuditLogEvent.RoleUpdate) {
                    actionName = 'ROLE_UPDATE';
                    category = 'ROLES';
                    details = `Обновлена роль: @${(entry.target as any)?.name || entry.targetId}`;
                } else if (actionType === 32 || actionType === AuditLogEvent.RoleDelete) {
                    actionName = 'ROLE_DELETE';
                    category = 'ROLES';
                    details = `Удалена роль: @${(entry.target as any)?.name || entry.targetId}`;
                } else if (actionType === 40 || actionType === AuditLogEvent.InviteCreate) {
                    actionName = 'INVITE_CREATE';
                    category = 'INVITES';
                    details = `Создано приглашение: code ${(entry.target as any)?.code || entry.targetId}`;
                } else if (actionType === 42 || actionType === AuditLogEvent.InviteDelete) {
                    actionName = 'INVITE_DELETE';
                    category = 'INVITES';
                    details = `Удалено приглашение: code ${(entry.target as any)?.code || entry.targetId}`;
                } else if (actionType === 60 || actionType === AuditLogEvent.EmojiCreate) {
                    actionName = 'EMOJI_CREATE';
                    category = 'CHANNELS';
                    details = `Создано эмодзи: :${(entry.target as any)?.name || entry.targetId}:`;
                } else if (actionType === 62 || actionType === AuditLogEvent.EmojiDelete) {
                    actionName = 'EMOJI_DELETE';
                    category = 'CHANNELS';
                    details = `Удалено эмодзи: :${(entry.target as any)?.name || entry.targetId}:`;
                } else if (actionType === 72 || actionType === AuditLogEvent.MessageDelete) {
                    actionName = 'MESSAGE_DELETE_MOD';
                    category = 'MESSAGES';
                    details = `Удалено сообщение в канале ${extra?.channel?.name ? `#${extra.channel.name}` : ''}`;
                } else if (actionType === 73 || actionType === AuditLogEvent.MessageBulkDelete) {
                    actionName = 'MESSAGE_BULK_DELETE';
                    category = 'MESSAGES';
                    details = `Очистка ${extra?.count || ''} сообщений в #${extra?.channel?.name || ''}`;
                } else if (actionType === 1 || actionType === AuditLogEvent.GuildUpdate) {
                    actionName = 'GUILD_UPDATE';
                    category = 'CHANNELS';
                    details = `Обновление параметров сервера Discord`;
                } else {
                    actionName = `DISCORD_${entry.action}`;
                    details = `Действие в Discord (Event #${entry.action})`;
                }

                // Check category filter
                if (categoryFilter === 'MODERATION' && !moderationActions.includes(actionName)) {
                    continue;
                }
                if (categoryFilter !== 'ALL' && categoryFilter !== 'MODERATION' && category !== categoryFilter) {
                    continue;
                }
                if (actionFilter !== 'ALL' && actionFilter !== actionName) {
                    continue;
                }

                discordLogs.push({
                    id: `discord_${entry.id}`,
                    source: 'DISCORD',
                    category,
                    action: actionName,
                    executorId: entry.executorId,
                    executorTag: entry.executor?.tag || entry.executor?.username || entry.executorId || 'Discord',
                    targetId: entry.targetId,
                    targetTag: (entry.target as any)?.tag || (entry.target as any)?.name || (entry.target as any)?.username || entry.targetId,
                    details,
                    metadata: {
                        reason: entry.reason || null,
                        changes: entry.changes || [],
                        extra: entry.extra || null,
                    },
                    createdAt: entry.createdAt,
                });
            }
        } catch (auditErr: any) {
            console.warn('Could not fetch Discord audit logs:', auditErr.message);
        }
    }

    // 3. Deduplicate (if both bot logged to DB and native Discord has it, keep DB log as primary)
    // and sort descending by timestamp
    const allLogs = [...formattedBotLogs, ...discordLogs];
    const uniqueLogsMap = new Map<string, any>();
    for (const item of allLogs) {
        // create a key based on action, target, executor, and time proximity (within 3s)
        const timeKey = Math.floor(new Date(item.createdAt).getTime() / 4000);
        const dedupeKey = `${item.action}_${item.targetId || ''}_${item.executorId || ''}_${timeKey}`;
        if (!uniqueLogsMap.has(dedupeKey)) {
            uniqueLogsMap.set(dedupeKey, item);
        }
    }

    let combined = Array.from(uniqueLogsMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 4. Apply text search
    if (search) {
        combined = combined.filter((item) => {
            const textToSearch = `${item.action} ${item.executorTag} ${item.executorId || ''} ${item.targetTag || ''} ${item.targetId || ''} ${item.details || ''} ${item.category} ${JSON.stringify(item.metadata || {})}`.toLowerCase();
            return textToSearch.includes(search);
        });
    }

    const totalCount = combined.length;
    const startIndex = (page - 1) * limit;
    const pagedEntries = combined.slice(startIndex, startIndex + limit);

    return res.json({
        entries: pagedEntries,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
    });

}));

/**
 * GET /api/logs/export
 * Export audit logs in JSON or CSV
 */
logsRouter.get('/export', requireAuth, requirePermission('viewLogs', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const guildId = (req as any).guildId;
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const limit = Math.min(1000, parseInt(req.query.limit as string, 10) || 500);

    const logs = await prisma.auditLogEntry.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });

    if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${guildId}.json"`);
        return res.json(logs);
    }

    // CSV format
    const headers = ['ID', 'Date (MSK)', 'Category', 'Action', 'Title', 'Description', 'ExecutorTag', 'ExecutorID', 'TargetTag', 'TargetID'];
    const rows = logs.map(l => [
        l.id,
        new Date(l.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
        l.category,
        l.action,
        `"${(l.title || '').replace(/"/g, '""')}"`,
        `"${(l.description || '').replace(/"/g, '""')}"`,
        l.executorTag || '',
        l.executorId || '',
        l.targetTag || '',
        l.targetId || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${guildId}.csv"`);
    return res.send(csvContent);
}));

export default logsRouter;

