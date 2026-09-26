import { Router, Response } from 'express';
import { EmbedBuilder, TextChannel, ActivityType } from 'discord.js';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { resolveGuildId, getDiscordGuild } from '../utils/guild';
import { buildCustomTemplateEmbed } from '../../bot/utils/templateEmbed';
import { BotMessageManager, BOT_MESSAGE_CATALOG } from '../../bot/utils/botMessageManager';

export const botMessagesRouter = Router();

// Get bot messages configuration, catalog and available embed templates
botMessagesRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);

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

  const templates = await prisma.customEmbedTemplate.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
  });

  const customMessages = await BotMessageManager.getGuildCustomMessages(guildId);
  const catalog = BotMessageManager.getCatalog();

  return res.json({
    config: cfg,
    templates,
    catalog,
    customMessages,
  });
});

// Update bot messages configuration & custom placeholder messages
botMessagesRouter.post('/', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const {
    welcomeEnabled,
    welcomeChannelId,
    welcomeTitle,
    welcomeMessage,
    welcomeEmbedColor,
    welcomeTemplateId,
    leaveEnabled,
    leaveChannelId,
    leaveMessage,
    leaveTemplateId,
    ticketGreetingTitle,
    ticketGreetingDesc,
    ticketTemplateId,
    botStatusText,
    botStatusActivity,
    customMessages,
  } = req.body;

  // If full customMessages dictionary provided, save via BotMessageManager
  if (customMessages && typeof customMessages === 'object') {
    await BotMessageManager.saveGuildCustomMessages(guildId, customMessages);
  }

  const cfg = await prisma.botMessagesConfig.upsert({
    where: { guildId },
    update: {
      welcomeEnabled: welcomeEnabled !== undefined ? Boolean(welcomeEnabled) : false,
      welcomeChannelId: welcomeChannelId || null,
      welcomeTitle: welcomeTitle || 'Добро пожаловать, {user}!',
      welcomeMessage: welcomeMessage || '',
      welcomeEmbedColor: welcomeEmbedColor || '#EC4899',
      welcomeTemplateId: welcomeTemplateId || null,
      leaveEnabled: leaveEnabled !== undefined ? Boolean(leaveEnabled) : false,
      leaveChannelId: leaveChannelId || null,
      leaveMessage: leaveMessage || '',
      leaveTemplateId: leaveTemplateId || null,
      ticketGreetingTitle: ticketGreetingTitle || '',
      ticketGreetingDesc: ticketGreetingDesc || '',
      ticketTemplateId: ticketTemplateId || null,
      botStatusText: botStatusText || 'Majestic RP',
      botStatusActivity: botStatusActivity || 'PLAYING',
    },
    create: {
      guildId,
      welcomeEnabled: welcomeEnabled !== undefined ? Boolean(welcomeEnabled) : false,
      welcomeChannelId: welcomeChannelId || null,
      welcomeTitle: welcomeTitle || 'Добро пожаловать, {user}!',
      welcomeMessage: welcomeMessage || '',
      welcomeEmbedColor: welcomeEmbedColor || '#EC4899',
      welcomeTemplateId: welcomeTemplateId || null,
      leaveEnabled: leaveEnabled !== undefined ? Boolean(leaveEnabled) : false,
      leaveChannelId: leaveChannelId || null,
      leaveMessage: leaveMessage || '',
      leaveTemplateId: leaveTemplateId || null,
      ticketGreetingTitle: ticketGreetingTitle || '',
      ticketGreetingDesc: ticketGreetingDesc || '',
      ticketTemplateId: ticketTemplateId || null,
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

  const updatedCustom = await BotMessageManager.getGuildCustomMessages(guildId);

  return res.json({ success: true, config: cfg, customMessages: updatedCustom });
});

// Update a single custom message template by key
botMessagesRouter.post('/custom/:key', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const key = req.params.key as string;
  const settings = req.body;

  const current = await BotMessageManager.getGuildCustomMessages(guildId);
  current[key] = {
    ...current[key],
    ...settings,
  };

  await BotMessageManager.saveGuildCustomMessages(guildId, current);
  return res.json({ success: true, customMessage: current[key] });
});

// Reset a specific message template to default
botMessagesRouter.post('/reset/:key', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const key = req.params.key as string;

  const current = await BotMessageManager.getGuildCustomMessages(guildId);
  delete current[key];

  await BotMessageManager.saveGuildCustomMessages(guildId, current);
  return res.json({ success: true, message: 'Шаблон сброшен к заводским настройкам' });
});

// Live test any catalog template in a selected Discord channel
botMessagesRouter.post('/test-template', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const { key, channelId, previewSettings } = req.body;

  const def = BotMessageManager.getDefinition(key);
  if (!def) {
    return res.status(404).json({ error: 'Шаблон сообщения не найден в каталоге' });
  }

  if (!channelId) {
    return res.status(400).json({ error: 'Выберите текстовый канал для отправки теста!' });
  }

  const guild = await getDiscordGuild(guildId);
  if (!guild) return res.status(404).json({ error: 'Сервер Discord не найден' });

  const channel = (guild.channels.cache.get(channelId) ||
    await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;

  if (!channel || !channel.isTextBased()) {
    return res.status(400).json({ error: 'Указанный канал недоступен для отправки сообщений' });
  }

  // Generate realistic samples for placeholders
  const sampleVars: Record<string, string> = {
    user: `<@${req.user!.userId}>`,
    username: req.user!.username,
    guild: guild.name,
    memberCount: String(guild.memberCount),
    date: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    rulesChannel: '<#123456789>',
    recruiterRole: '<@&123456789>',
    recruiter: `<@${req.user!.userId}>`,
    role: '@Участник',
    reason: 'Тестовая причина для предварительного просмотра',
    staticId: '142055',
    mentorRole: '@Инструктор',
    stageName: 'Теория и Правила',
    mentor: `<@${req.user!.userId}>`,
    progress: '2/3 (66%)',
    newRank: '2 - Участник',
    oldRank: '1 - Академик',
    eventTitle: 'Война за завод (ВЗЗ)',
    eventType: 'LIMITED',
    mapName: 'Завод',
    eventTime: '20:00',
    checkInTime: '19:45',
    voiceChannel: '#Сбор-ВЗЗ',
    partyCode: 'INT-99',
    limit: '25',
    author: `<@${req.user!.userId}>`,
    minutesLeft: '5',
    confirmedCount: '20',
    days: '7',
    untilDate: '03.10.2026',
    admin: `<@${req.user!.userId}>`,
    tierName: 'Tier 1',
    checkerRole: '@Tier Checker',
    checker: `<@${req.user!.userId}>`,
    score: '9/10',
    mpName: 'Капт #1',
    host: `<@${req.user!.userId}>`,
    startTime: '20:00',
    duration: '35 мин.',
    participantCount: '22',
    characterName: 'Tony Montana',
    mpCount: '15',
    executor: `<@${req.user!.userId}>`,
    action: 'Тестовая проверка безопасности',
    target: 'Роль @Лидер',
    punishment: 'Снятие всех ролей',
  };

  // Build message using either passed preview settings or database/catalog settings
  const custom = previewSettings || (await BotMessageManager.getGuildCustomMessages(guildId))[key] || {};

  const rawTitle = custom.title !== undefined && custom.title !== '' ? custom.title : def.defaultTitle;
  const rawDesc = custom.description !== undefined && custom.description !== '' ? custom.description : def.defaultDescription;
  const rawColor = custom.color || def.defaultColor || '#EC4899';
  const rawFooter = custom.footer || def.defaultFooter || 'INTERPOL • Majestic RP';
  const rawContent = custom.content !== undefined ? custom.content : (def.defaultContent || '');

  const title = BotMessageManager.replacePlaceholders(rawTitle, sampleVars);
  const description = BotMessageManager.replacePlaceholders(rawDesc, sampleVars);
  const footer = BotMessageManager.replacePlaceholders(rawFooter, sampleVars);
  const content = BotMessageManager.replacePlaceholders(rawContent, sampleVars);

  const cleanHex = rawColor.replace('#', '');
  const colorInt = parseInt(cleanHex, 16) || 0xEC4899;

  const embed = new EmbedBuilder()
    .setColor(colorInt)
    .setTitle(title || null)
    .setDescription(description || null)
    .setFooter({ text: `${footer} • ТЕСТОВОЕ СООБЩЕНИЕ` })
    .setTimestamp();

  await channel.send({
    content: content.trim() ? `[ТЕСТ ПЛЕЙСХОЛДЕРОВ]\n${content.trim()}` : undefined,
    embeds: [embed],
  });

  return res.json({ success: true, message: `Тестовое сообщение «${def.name}» успешно отправлено в #${channel.name}` });
});

// Legacy test endpoint for welcome / leave
botMessagesRouter.post('/test', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const { type, channelId } = req.body; // type: 'welcome' | 'leave'

  const cfg = await prisma.botMessagesConfig.findUnique({
    where: { guildId },
  });

  if (!cfg) return res.status(404).json({ error: 'Config not found' });

  const targetChannelId = channelId || (type === 'welcome' ? cfg.welcomeChannelId : cfg.leaveChannelId);
  if (!targetChannelId) {
    return res.status(400).json({ error: 'Канал для отправки не выбран!' });
  }

  const guild = await getDiscordGuild(guildId);
  if (!guild) return res.status(404).json({ error: 'Discord Guild not found' });

  const channel = (guild.channels.cache.get(targetChannelId) ||
    await guild.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null;

  if (!channel || !channel.isTextBased()) {
    return res.status(400).json({ error: 'Указанный канал недоступен для отправки сообщений' });
  }

  const userMention = `<@${req.user!.userId}>`;
  const guildName = guild.name;
  const memberCount = String(guild.memberCount);

  // Check if a CustomEmbedTemplate is linked
  const templateId = type === 'welcome' ? cfg.welcomeTemplateId : cfg.leaveTemplateId;
  let customTemplate: any = null;
  if (templateId) {
    customTemplate = await prisma.customEmbedTemplate.findUnique({ where: { id: templateId } });
  }

  if (customTemplate) {
    try {
      const embed = buildCustomTemplateEmbed(customTemplate, {
        user: userMention,
        username: req.user!.username,
        guild: guildName,
        memberCount,
      });

      await channel.send({ embeds: [embed] });
      return res.json({ success: true, usedTemplate: customTemplate.name });
    } catch (e: any) {
      console.warn('Failed building template embed, falling back:', e.message);
    }
  }

  const rendered = await BotMessageManager.renderMessage(guildId, type, {
    user: userMention,
    username: req.user!.username,
    guild: guildName,
    memberCount,
    date: new Date().toLocaleDateString('ru-RU'),
  });

  await channel.send({
    content: rendered.content,
    embeds: [rendered.embed],
  });

  return res.json({ success: true });
});

export default botMessagesRouter;
