import { Router, Response } from 'express';
import { EmbedBuilder, TextChannel, ActivityType } from 'discord.js';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { AuditLogger } from '../../bot/modules/logging/auditLogger';

export const botMessagesRouter = Router();

// Get bot messages configuration
botMessagesRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;

  let cfg = await prisma.botMessagesConfig.findUnique({
    where: { guildId },
  });

  if (!cfg) {
    cfg = await prisma.botMessagesConfig.create({
      data: {
        guildId,
        welcomeEnabled: false,
        welcomeTitle: 'Добро пожаловать в семью, {user}!',
        welcomeMessage: 'Рады приветствовать тебя на нашем сервере {guild}! Ознакомься с правилами и подай заявку в семью.',
        welcomeEmbedColor: '#EC4899',
        leaveEnabled: false,
        leaveMessage: '{user} покинул наш сервер.',
        ticketGreetingTitle: 'Заявка в семью INTERPOL',
        ticketGreetingDesc: 'Приветствуем, {user}!\nВаша анкета получена. Ожидайте рассмотрения рекрутерами семьи.\nНе забудьте подготовить скриншоты статистики.',
        botStatusText: 'Majestic RP • /event',
        botStatusActivity: 'PLAYING',
      },
    });
  }

  return res.json({ config: cfg });
});

// Update bot messages configuration
botMessagesRouter.post('/', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;
  const {
    welcomeEnabled,
    welcomeChannelId,
    welcomeTitle,
    welcomeMessage,
    welcomeEmbedColor,
    leaveEnabled,
    leaveChannelId,
    leaveMessage,
    ticketGreetingTitle,
    ticketGreetingDesc,
    botStatusText,
    botStatusActivity,
  } = req.body;

  const cfg = await prisma.botMessagesConfig.upsert({
    where: { guildId },
    update: {
      welcomeEnabled: !!welcomeEnabled,
      welcomeChannelId: welcomeChannelId || null,
      welcomeTitle: welcomeTitle || 'Добро пожаловать, {user}!',
      welcomeMessage: welcomeMessage || '',
      welcomeEmbedColor: welcomeEmbedColor || '#EC4899',
      leaveEnabled: !!leaveEnabled,
      leaveChannelId: leaveChannelId || null,
      leaveMessage: leaveMessage || '',
      ticketGreetingTitle: ticketGreetingTitle || '',
      ticketGreetingDesc: ticketGreetingDesc || '',
      botStatusText: botStatusText || 'Majestic RP',
      botStatusActivity: botStatusActivity || 'PLAYING',
    },
    create: {
      guildId,
      welcomeEnabled: !!welcomeEnabled,
      welcomeChannelId: welcomeChannelId || null,
      welcomeTitle: welcomeTitle || 'Добро пожаловать, {user}!',
      welcomeMessage: welcomeMessage || '',
      welcomeEmbedColor: welcomeEmbedColor || '#EC4899',
      leaveEnabled: !!leaveEnabled,
      leaveChannelId: leaveChannelId || null,
      leaveMessage: leaveMessage || '',
      ticketGreetingTitle: ticketGreetingTitle || '',
      ticketGreetingDesc: ticketGreetingDesc || '',
      botStatusText: botStatusText || 'Majestic RP',
      botStatusActivity: botStatusActivity || 'PLAYING',
    },
  });

  // Dynamically update Discord bot presence / activity
  try {
    if (bot.user && botStatusText) {
      let actType = ActivityType.Playing;
      if (botStatusActivity === 'WATCHING') actType = ActivityType.Watching;
      else if (botStatusActivity === 'LISTENING') actType = ActivityType.Listening;
      else if (botStatusActivity === 'COMPETING') actType = ActivityType.Competing;

      bot.user.setActivity(botStatusText, { type: actType });
    }
  } catch (err) {
    console.error('[BotMessages] Error setting bot presence:', err);
  }

  return res.json({ success: true, config: cfg });
});

// Test sending a welcome or leave message
botMessagesRouter.post('/test', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;
  const { type, channelId } = req.body; // type: 'welcome' | 'leave'

  const cfg = await prisma.botMessagesConfig.findUnique({
    where: { guildId },
  });

  if (!cfg) return res.status(404).json({ error: 'Config not found' });

  const targetChannelId = channelId || (type === 'welcome' ? cfg.welcomeChannelId : cfg.leaveChannelId);
  if (!targetChannelId) {
    return res.status(400).json({ error: 'Канал для отправки не выбран!' });
  }

  const guild = bot.guilds.cache.get(guildId);
  if (!guild) return res.status(404).json({ error: 'Discord Guild not found' });

  const channel = (guild.channels.cache.get(targetChannelId) ||
    await guild.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null;

  if (!channel || !channel.isTextBased()) {
    return res.status(400).json({ error: 'Указанный канал недоступен для отправки сообщений' });
  }

  const userMention = `<@${req.user!.userId}>`;
  const guildName = guild.name;
  const memberCount = String(guild.memberCount);

  if (type === 'welcome') {
    const rawColor = cfg.welcomeEmbedColor?.replace('#', '') || 'EC4899';
    const colorInt = parseInt(rawColor, 16) || 0xEC4899;

    const formattedTitle = (cfg.welcomeTitle || 'Добро пожаловать!')
      .replace(/{user}/g, req.user!.username)
      .replace(/{guild}/g, guildName)
      .replace(/{memberCount}/g, memberCount);

    const formattedDesc = (cfg.welcomeMessage || '')
      .replace(/{user}/g, userMention)
      .replace(/{guild}/g, guildName)
      .replace(/{memberCount}/g, memberCount);

    const embed = new EmbedBuilder()
      .setColor(colorInt)
      .setTitle(formattedTitle)
      .setDescription(formattedDesc)
      .setThumbnail(guild.iconURL() || null)
      .setFooter({ text: `Тестовое сообщение • Участник #${memberCount}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } else {
    const formattedDesc = (cfg.leaveMessage || '{user} покинул сервер.')
      .replace(/{user}/g, `**${req.user!.username}**`)
      .replace(/{guild}/g, guildName)
      .replace(/{memberCount}/g, memberCount);

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setDescription(`🚪 ${formattedDesc}`)
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }

  return res.json({ success: true });
});

export default botMessagesRouter;
