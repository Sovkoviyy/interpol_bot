import { Router, Response } from 'express';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { EventService } from '../../bot/modules/events/eventService';
import { TextChannel } from 'discord.js';

export const eventsRouter = Router();

// Get remembered default channels and roles
eventsRouter.get('/defaults', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;
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
  const guildId = req.user?.guildId || config.discord.guildId;
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
  const guildId = req.user?.guildId || config.discord.guildId;
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
  const pingContent = targetRoleId ? `<@&${targetRoleId}>` : (type === 'UNLIMITED' ? '@here' : undefined);

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

  return res.json({ success: true, event });
});

// Cancel / Finish event
eventsRouter.post('/:id/status', requireAuth, requirePermission('manageEvents'), async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body; // FINISHED or CANCELLED

  const event = await prisma.eventGathering.update({
    where: { id },
    data: { status },
  });

  const guild = bot.guilds.cache.get(event.guildId);
  if (guild) {
    await EventService.refreshAnnouncement(guild, event.id);
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
  }

  return res.json({ success: true, promotedUserId });
});

export default eventsRouter;
