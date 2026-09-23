import { Router, Response } from 'express';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { RecruitmentService } from '../../bot/modules/recruitment/recruitmentService';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { resolveGuildId } from '../utils/guild';

export const recruitmentRouter = Router();

// Get recruitment configuration
recruitmentRouter.get('/config', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const recConfig = await prisma.recruitmentConfig.findUnique({
    where: { guildId },
  });

  const defaultQuestions = RecruitmentService.getDefaultQuestions();

  if (!recConfig) {
    return res.json({
      config: {
        guildId,
        channelId: null,
        messageId: null,
        categoryId: null,
        logChannelId: null,
        memberRoleId: null,
        recruiterRoleIds: [],
        questions: defaultQuestions,
        welcomeMessage: 'Добро пожаловать в заявку! Ожидайте ответа рекрутера.',
        rejectionMessage: 'К сожалению, вы не прошли собеседование.',
      },
    });
  }

  let questions = defaultQuestions;
  try {
    questions = JSON.parse(recConfig.questionsJson || '[]');
    if (questions.length === 0) questions = defaultQuestions;
  } catch {
    questions = defaultQuestions;
  }

  let recruiterRoleIds: string[] = [];
  try {
    recruiterRoleIds = JSON.parse(recConfig.recruiterRoleIds || '[]');
  } catch {
    recruiterRoleIds = [];
  }

  return res.json({
    config: {
      ...recConfig,
      questions,
      recruiterRoleIds,
    },
  });
});

// Update recruitment configuration
recruitmentRouter.post('/config', requireAuth, requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const {
    channelId,
    categoryId,
    logChannelId,
    memberRoleId,
    recruiterRoleIds,
    questions,
    welcomeMessage,
    rejectionMessage,
  } = req.body;

  const updated = await prisma.recruitmentConfig.upsert({
    where: { guildId },
    update: {
      channelId,
      categoryId,
      logChannelId,
      memberRoleId,
      recruiterRoleIds: JSON.stringify(recruiterRoleIds || []),
      questionsJson: JSON.stringify(questions || []),
      welcomeMessage,
      rejectionMessage,
    },
    create: {
      guildId,
      channelId,
      categoryId,
      logChannelId,
      memberRoleId,
      recruiterRoleIds: JSON.stringify(recruiterRoleIds || []),
      questionsJson: JSON.stringify(questions || []),
      welcomeMessage,
      rejectionMessage,
    },
  });

  return res.json({ success: true, config: updated });
});

// Get applications list
recruitmentRouter.get('/applications', requireAuth, requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const status = req.query.status as string;

  const whereClause: any = { guildId };
  if (status && status !== 'ALL') {
    whereClause.status = status;
  }

  const applications = await prisma.recruitmentApplication.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const parsed = applications.map(app => {
    let answers = {};
    try {
      answers = JSON.parse(app.answersJson || '{}');
    } catch {
      answers = {};
    }
    return { ...app, answers };
  });

  return res.json({ applications: parsed });
});

// Post recruitment embed in Discord channel from web dashboard
recruitmentRouter.post('/post-panel', requireAuth, requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const recConfig = await prisma.recruitmentConfig.findUnique({ where: { guildId } });

  if (!recConfig || !recConfig.channelId) {
    return res.status(400).json({ error: 'Канал для публикации не выбран в настройках' });
  }

  const guild = bot.guilds.cache.get(guildId);
  if (!guild) {
    return res.status(400).json({ error: 'Бот не подключен к серверу Discord' });
  }

  const channel = guild.channels.cache.get(recConfig.channelId) as TextChannel | undefined;
  if (!channel || !channel.isTextBased()) {
    return res.status(400).json({ error: 'Канал не найден или не является текстовым' });
  }

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`🦅 Набор в семью ${guild.name}`)
    .setDescription(
      `Приветствуем тебя на сервере семьи **${guild.name}**!\n\n` +
      `Мы всегда рады активным, целеустремленным и адекватным игрокам.\n` +
      `Если ты хочешь стать частью нашей команды, участвовать в дропах, цехах, каптах и других активностях — нажми кнопку ниже и заполни анкету!\n\n` +
      `📌 **Перед подачей убедись:**\n` +
      `• Твой Discord открыт для получения сообщений от бота;\n` +
      `• Ты заполнил все поля анкеты честно и без обмана.`
    )
    .setThumbnail(guild.iconURL({ size: 256 }))
    .setFooter({ text: `${guild.name} • Система рекрутинга` })
    .setTimestamp();

  const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('recruit_apply_button')
      .setLabel('Подать заявку')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary)
  );

  const msg = await channel.send({ embeds: [embed], components: [button] });

  await prisma.recruitmentConfig.update({
    where: { guildId },
    data: { messageId: msg.id },
  });

  return res.json({ success: true, messageId: msg.id });
});

export default recruitmentRouter;
