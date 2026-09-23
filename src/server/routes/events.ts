import { Router, Response } from 'express';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { EventService } from '../../bot/modules/events/eventService';
import { TextChannel, EmbedBuilder } from 'discord.js';
import { AuditLogger } from '../../bot/modules/logging/auditLogger';
import { resolveGuildId } from '../utils/guild';

export const eventsRouter = Router();

// Get remembered default channels and roles
eventsRouter.get('/defaults', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const guildConfig = await prisma.guildConfig.findUnique({
    where: { guildId },
  });

  return res.json({
    channelId: guildConfig?.defaultEventChannelId || '',
    voiceChannelId: guildConfig?.defaultVoiceChannelId || '',
    targetRoleId: guildConfig?.defaultMentionRoleId || '',
  });
});

// Get list of events
eventsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const status = req.query.status as string;

  const whereClause: any = { guildId };
  if (status && status !== 'ALL') {
    whereClause.status = status;
  }

  const events = await prisma.eventGathering.findMany({
    where: whereClause,
    include: {
      participants: { orderBy: { joinedAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return res.json({ events });
});

// Create event from web dashboard
eventsRouter.post('/', requireAuth, requirePermission('manageEvents'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const {
    title,
    description,
    type,
    checkInTime,
    eventTime,
    partyCode,
    voiceChannelId,
    targetRoleId,
    channelId,
    participantLimit,
    pingIntervals,
  } = req.body;

  if (!title || !type || !checkInTime || !eventTime || !channelId) {
    return res.status(400).json({ error: 'Заполните обязательные поля (название, тип, время явки, время начала, канал)' });
  }

  const guild = bot.guilds.cache.get(guildId);
  if (!guild) {
    return res.status(400).json({ error: 'Бот не подключен к серверу' });
  }

  const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!channel || !channel.isTextBased()) {
    return res.status(400).json({ error: 'Канал для анонса не найден' });
  }

  const event = await prisma.eventGathering.create({
    data: {
      guildId,
      title,
      description,
      type,
      checkInTime: new Date(checkInTime),
      eventTime: new Date(eventTime),
      partyCode,
      voiceChannelId,
      targetRoleId,
      channelId,
      participantLimit: type === 'LIMITED' ? (parseInt(participantLimit, 10) || 10) : null,
      status: 'ACTIVE',
      createdById: req.user!.userId,
      createdByTag: req.user!.username,
      pingIntervalsJson: JSON.stringify(pingIntervals || [15, 10, 5, 3, 1]),
    },
  });

  // Post announcement
  const embed = await EventService.buildEventEmbed(event.id);
  const components = EventService.buildEventButtons(event.id, type === 'LIMITED');

  let pingContent: string | undefined = undefined;
  if (targetRoleId === 'everyone') {
    pingContent = '@everyone';
  } else if (targetRoleId === 'here') {
    pingContent = '@here';
  } else if (targetRoleId === 'none') {
    pingContent = undefined;
  } else if (targetRoleId) {
    pingContent = `<@&${targetRoleId}>`;
  } else if (type === 'UNLIMITED') {
    pingContent = '@here';
  }

  const msg = await channel.send({
    content: pingContent,
    embeds: [embed],
    components,
  });

  await prisma.eventGathering.update({
    where: { id: event.id },
    data: { messageId: msg.id },
  });

  // Remember chosen channels and role for future events
  await prisma.guildConfig.upsert({
    where: { guildId },
    update: {
      defaultEventChannelId: channelId,
      defaultVoiceChannelId: voiceChannelId || null,
      defaultMentionRoleId: targetRoleId || null,
    },
    create: {
      guildId,
      defaultEventChannelId: channelId,
      defaultVoiceChannelId: voiceChannelId || null,
      defaultMentionRoleId: targetRoleId || null,
    },
  }).catch(() => null);

  let mentionDisplay = 'Без упоминания';
  if (targetRoleId === 'everyone') mentionDisplay = '@everyone';
  else if (targetRoleId === 'here') mentionDisplay = '@here';
  else if (targetRoleId && targetRoleId !== 'none') mentionDisplay = `<@&${targetRoleId}>`;
  else if (type === 'UNLIMITED') mentionDisplay = '@here (по умолчанию)';

  // Send audit log to #ивенты-лог
  const createEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📢 Создано новое мероприятие: ${event.title}`)
    .setDescription(
      `Создатель: <@${req.user!.userId}> (${req.user!.username})\n` +
      `Канал сбора: <#${channelId}>\n` +
      `Упоминание: **${mentionDisplay}**\n` +
      `Тип: **${type === 'LIMITED' ? `С ограничением (${participantLimit || 10} мест)` : 'Без ограничений'}**\n` +
      `Чек-ин: <t:${Math.floor(new Date(checkInTime).getTime() / 1000)}:f>\n` +
      `Старт: <t:${Math.floor(new Date(eventTime).getTime() / 1000)}:f>`
    )
    .setTimestamp();
  await AuditLogger.sendLog(guild, 'EVENTS', createEmbed);

  return res.json({ success: true, event });
});

// Cancel / Finish event
eventsRouter.post('/:id/status', requireAuth, requirePermission('manageEvents'), async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body; // FINISHED or CANCELLED

  const now = new Date();
  const event = await prisma.eventGathering.update({
    where: { id },
    data: { 
      status,
      finishedAt: (status === 'FINISHED' || status === 'CANCELLED') ? now : undefined,
    },
  });

  const guild = bot.guilds.cache.get(event.guildId);
  if (guild) {
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
  }

  return res.json({ success: true, event });
});

// Kick participant from web dashboard
eventsRouter.post('/:id/participants/:userId/kick', requireAuth, requirePermission('manageEvents'), async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.params.userId as string;

  const event = await prisma.eventGathering.findUnique({
    where: { id },
    include: { participants: { orderBy: { joinedAt: 'asc' } } },
  });

  if (!event) return res.status(404).json({ error: 'Event not found' });

  const targetParticipant = event.participants.find((p: any) => p.userId === userId);
  if (!targetParticipant) return res.status(404).json({ error: 'Participant not in list' });

  const wasConfirmed = targetParticipant.status === 'CONFIRMED';
  await prisma.eventParticipant.delete({ where: { id: targetParticipant.id } });

  let promotedUserId: string | null = null;
  if (wasConfirmed) {
    const firstReserve = event.participants.find((p: any) => p.status === 'RESERVE' && p.userId !== userId);
    if (firstReserve) {
      await prisma.eventParticipant.update({
        where: { id: firstReserve.id },
        data: { status: 'CONFIRMED' },
      });
      promotedUserId = firstReserve.userId;
    }
  }

  const guild = bot.guilds.cache.get(event.guildId);
  if (guild) {
    await EventService.refreshAnnouncement(guild, event.id);

    const kickEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(`❌ Исключение с мероприятия: ${event.title}`)
      .setDescription(
        `Участник <@${userId}> был исключен из мероприятия **${event.title}** администратором <@${req.user!.userId}>.\n` +
        (promotedUserId ? `⬆️ Из резерва в основной состав переведен: <@${promotedUserId}>.` : '')
      )
      .setTimestamp();
    await AuditLogger.sendLog(guild, 'EVENTS', kickEmbed);
  }

  return res.json({ success: true, promotedUserId });
});

export default eventsRouter;
