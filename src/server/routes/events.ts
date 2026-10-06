import { Router, Response } from 'express';
import bot from '../../bot/client';
import config from '../../config';

import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { EventService } from '../../bot/modules/events/eventService';
import { TextChannel, EmbedBuilder } from 'discord.js';
import { AuditLogger } from '../../bot/modules/logging/auditLogger';
import { BotMessageManager } from '../../bot/utils/botMessageManager';
import { getDiscordGuild } from '../utils/guild';
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireGuildId } from "../middlewares/requireGuildId";

export const eventsRouter = Router();

// Get event settings (priority role, min rank, and role hierarchy)
eventsRouter.get('/config', requireAuth, requirePermission('manageEvents', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const guildConfig = await EventService.getGuildConfig(guildId);

    let eventRoleHierarchy: any[] = [];
    try {
        if (guildConfig?.eventRoleHierarchyJson) {
            eventRoleHierarchy = JSON.parse(guildConfig.eventRoleHierarchyJson);
        }
    } catch {
        eventRoleHierarchy = [];
    }

    return res.json({
        eventPriorityRoleId: guildConfig?.eventPriorityRoleId || '',
        eventPriorityMinRank: guildConfig?.eventPriorityMinRank || 0,
        eventRoleHierarchy,
    });

}));

// Save event settings
eventsRouter.post('/config', requireAuth, requirePermission('manageEvents'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const { eventPriorityRoleId, eventPriorityMinRank, eventRoleHierarchy } = req.body;

    const hierarchyJson = JSON.stringify(Array.isArray(eventRoleHierarchy) ? eventRoleHierarchy : []);

    const updated = await EventService.upsertGuildConfig(
        guildId,
        {
            eventPriorityRoleId: eventPriorityRoleId || null,
            eventPriorityMinRank: parseInt(eventPriorityMinRank, 10) || 0,
            eventRoleHierarchyJson: hierarchyJson,
        },
        {
            guildId,
            eventPriorityRoleId: eventPriorityRoleId || null,
            eventPriorityMinRank: parseInt(eventPriorityMinRank, 10) || 0,
            eventRoleHierarchyJson: hierarchyJson,
        }
    );
    return res.json({ config: updated });

}));

// Get remembered default channels and roles
eventsRouter.get('/defaults', requireAuth, requirePermission('manageEvents', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const guildConfig = await EventService.getGuildConfig(guildId);

    return res.json({
        channelId: guildConfig?.defaultEventChannelId || '',
        voiceChannelId: guildConfig?.defaultVoiceChannelId || '',
        targetRoleId: guildConfig?.defaultMentionRoleId || '',
    });
}));

// Get list of events
eventsRouter.get('/', requireAuth, requirePermission('manageEvents', 'manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const status = req.query.status as string;

    const whereClause: any = { guildId };
    if (status && status !== 'ALL') {
        whereClause.status = status;
    }

    const events = await EventService.getEvents(whereClause);

    const guild = await getDiscordGuild(guildId);
    const memberNicknames = new Map<string, string>();

    if (guild) {
        const allUserIds = Array.from(new Set(events.flatMap(e => e.participants.map(p => p.userId))));
        const missingIds: string[] = [];

        for (const uid of allUserIds) {
            const cached = guild.members.cache.get(uid);
            if (cached) {
                memberNicknames.set(uid, cached.nickname || cached.displayName || cached.user.username);
            } else {
                missingIds.push(uid);
            }
        }

        if (missingIds.length > 0) {
            try {
                const fetched = await guild.members.fetch({ user: missingIds }).catch(() => null);
                if (fetched) {
                    for (const [uid, m] of fetched) {
                        memberNicknames.set(uid, m.nickname || m.displayName || m.user.username);
                    }
                }
            } catch { }
        }

        // Fallback: check UserProfile if any user wasn't fetched
        const remainingIds = allUserIds.filter(id => !memberNicknames.has(id));
        if (remainingIds.length > 0) {
            const profiles = await EventService.getUserProfiles(guildId, remainingIds);
            for (const prof of profiles) {
                if (prof.characterName) {
                    memberNicknames.set(prof.userId, prof.characterName);
                }
            }
        }
    }

    const enrichedEvents = events.map(event => ({
        ...event,
        participants: event.participants.map(p => {
            const serverNick = memberNicknames.get(p.userId);
            return {
                ...p,
                displayName: serverNick || p.userTag || p.userId,
                serverNickname: serverNick || p.userTag || p.userId,
            };
        }),
    }));

    return res.json({ events: enrichedEvents });
}));

// Create event from web dashboard (only LIMITED allowed: Capt, VZZ, MCL)
eventsRouter.post('/', requireAuth, requirePermission('manageEvents'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const {
        title,
        description,
        checkInTime,
        eventTime,
        partyCode,
        voiceChannelId,
        targetRoleId,
        channelId,
        participantLimit,
        pingIntervals,
    } = req.body;

    if (!title || !checkInTime || !eventTime || !channelId) {
        return res.status(400).json({ error: 'Заполните обязательные поля (название, время явки, время начала, канал)' });
    }

    const guild = await getDiscordGuild(guildId);
    if (!guild) {
        return res.status(400).json({ error: 'Бот не подключен к серверу' });
    }

    const channel = (guild.channels.cache.get(channelId) ||
        await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
    if (!channel || !channel.isTextBased()) {
        return res.status(400).json({ error: 'Канал для анонса не найден' });
    }

    // All events are LIMITED with a participant limit
    const limit = Math.max(1, parseInt(participantLimit, 10) || 10);

    const event = await EventService.createEvent({
        guildId,
        title,
        description,
        type: 'LIMITED',
        checkInTime: new Date(checkInTime),
        eventTime: new Date(eventTime),
        partyCode,
        voiceChannelId,
        targetRoleId,
        channelId,
        participantLimit: limit,
        status: 'ACTIVE',
        createdById: req.user!.userId,
        createdByTag: req.user!.username,
        pingIntervalsJson: JSON.stringify(pingIntervals || [15, 10, 5, 3, 1]),
    });

    // Post announcement
    const embed = await EventService.buildEventEmbed(event.id);
    const components = EventService.buildEventButtons(event.id, true);

    let pingContent: string | undefined = undefined;
    if (targetRoleId === 'everyone') {
        pingContent = '@everyone';
    } else if (targetRoleId === 'here') {
        pingContent = '@here';
    } else if (targetRoleId === 'none') {
        pingContent = undefined;
    } else if (targetRoleId) {
        pingContent = `<@&${targetRoleId}>`;
    }

    const msg = await channel.send({
        content: pingContent,
        embeds: [embed],
        components,
    });

    await EventService.updateEvent(event.id, { messageId: msg.id });

    // Remember chosen channels and role for future events
    await EventService.upsertGuildConfig(
        guildId,
        {
            defaultEventChannelId: channelId,
            defaultVoiceChannelId: voiceChannelId || null,
            defaultMentionRoleId: targetRoleId || null,
        },
        {
            guildId,
            defaultEventChannelId: channelId,
            defaultVoiceChannelId: voiceChannelId || null,
            defaultMentionRoleId: targetRoleId || null,
        }
    ).catch(() => null);

    let mentionDisplay = 'Без упоминания';
    if (targetRoleId === 'everyone') mentionDisplay = '@everyone';
    else if (targetRoleId === 'here') mentionDisplay = '@here';
    else if (targetRoleId && targetRoleId !== 'none') mentionDisplay = `<@&${targetRoleId}>`;

    // Send audit log to #ивенты-лог
    const createEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📢 Создано новое мероприятие: ${event.title}`)
        .setDescription(
            `Создатель: <@${req.user!.userId}> (${req.user!.username})\n` +
            `Канал сбора: <#${channelId}>\n` +
            `Упоминание: **${mentionDisplay}**\n` +
            `Тип: **С ограничением (${limit} мест)**\n` +
            `Чек-ин: <t:${Math.floor(new Date(checkInTime).getTime() / 1000)}:f>\n` +
            `Старт: <t:${Math.floor(new Date(eventTime).getTime() / 1000)}:f>`
        )
        .setTimestamp();
    await AuditLogger.sendLog(guild, 'EVENTS', createEmbed);

    return res.json({ success: true, event });
}));

// Cancel / Finish event
eventsRouter.post('/:id/status', requireAuth, requirePermission('manageEvents'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const id = req.params.id as string;
    const { status } = req.body; // FINISHED or CANCELLED

    const now = new Date();
    const event = await EventService.updateEvent(id, {
        status,
        finishedAt: (status === 'FINISHED' || status === 'CANCELLED') ? now : undefined,
    });

    const guild = await getDiscordGuild(event.guildId);
    if (guild) {
        const { EventScheduler } = await import('../../bot/modules/events/eventScheduler');
        await EventScheduler.deleteEventReminder(event.guildId, event.id, event.channelId);

        await EventService.refreshAnnouncement(guild, event.id);

        const statusText = status === 'FINISHED' ? 'завершено' : 'отменено';
        const statusEmbed = new EmbedBuilder()
            .setColor(status === 'FINISHED' ? 0x2ECC71 : 0xED4245)
            .setTitle(`📅 Статус мероприятия изменен: ${event.title}`)
            .setDescription(
                `Мероприятие **«${event.title}»** было **${statusText}** администратором <@${req.user!.userId}>.\n` +
                `Канал: <#${event.channelId}>`
            )
            .setTimestamp();
        await AuditLogger.sendLog(guild, 'EVENTS', statusEmbed);

        if (status === 'CANCELLED' && event.channelId) {
            const cancelRendered = await BotMessageManager.renderMessage(event.guildId, 'event_cancelled', {
                eventTitle: event.title,
                reason: (req.body.reason as string) || 'Отменено организатором',
                author: `<@${req.user!.userId}>`,
                role: event.targetRoleId ? `<@&${event.targetRoleId}>` : '@everyone',
                guild: guild.name,
            });
            if (cancelRendered.enabled) {
                const evChannel = guild.channels.cache.get(event.channelId) as TextChannel | null;
                if (evChannel && evChannel.isTextBased()) {
                    await evChannel.send({
                        content: cancelRendered.content || undefined,
                        embeds: [cancelRendered.embed],
                    }).catch(() => null);
                }
            }
        }
    }

    return res.json({ success: true, event });
}));

// Kick participant from web dashboard
eventsRouter.post('/:id/participants/:userId/kick', requireAuth, requirePermission('manageEvents'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const id = req.params.id as string;
    const userId = req.params.userId as string;

    const event = await EventService.getEventByIdWithParticipants(id);

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const targetParticipant = event.participants.find((p: any) => p.userId === userId);
    if (!targetParticipant) return res.status(404).json({ error: 'Participant not in list' });

    await EventService.deleteParticipant(targetParticipant.id);

    // Manual kick by admin: DO NOT auto-promote from reserve! Slot stays open for manual filling.
    const guild = await getDiscordGuild(event.guildId);
    if (guild) {
        await EventService.refreshAnnouncement(guild, event.id);

        const kickEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle(`❌ Исключение с мероприятия: ${event.title}`)
            .setDescription(
                `Участник <@${userId}> был исключен из мероприятия **${event.title}** администратором <@${req.user!.userId}>.\n` +
                `Слот в составе освобожден для ручного распределения.`
            )
            .setTimestamp();
        await AuditLogger.sendLog(guild, 'EVENTS', kickEmbed);
    }

    return res.json({ success: true });
}));

// Swap two participants directly
eventsRouter.post('/:id/swap', requireAuth, requirePermission('manageEvents'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const id = req.params.id as string;
    const { userId1, userId2 } = req.body;

    if (!userId1 || !userId2) {
        return res.status(400).json({ error: 'userId1 and userId2 are required' });
    }

    const result = await EventService.swapParticipants(guildId, id, userId1, userId2, req.user!.userId);
    return res.json(result);

}));

// Move participant between CONFIRMED (Main) and RESERVE (or swap)
eventsRouter.post('/:id/participants/:userId/move', requireAuth, requirePermission('manageEvents'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const { targetStatus, swapWithUserId } = req.body; // 'CONFIRMED' | 'RESERVE'

    if (targetStatus !== 'CONFIRMED' && targetStatus !== 'RESERVE') {
        return res.status(400).json({ error: 'targetStatus must be CONFIRMED or RESERVE' });
    }

    const result = await EventService.moveParticipant(
        guildId,
        id,
        userId,
        targetStatus,
        req.user!.userId,
        swapWithUserId
    );

    return res.json(result);

}));

// Rebalance roster based on configured role hierarchy
eventsRouter.post('/:id/rebalance', requireAuth, requirePermission('manageEvents'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const id = req.params.id as string;

    const result = await EventService.rebalanceRoster(guildId, id, req.user!.userId);
    return res.json(result);

}));

export default eventsRouter;
