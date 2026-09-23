import { Router, Response } from 'express';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { AuditLogger } from '../../bot/modules/logging/auditLogger';
import { resolveGuildId } from '../utils/guild';

export const logsRouter = Router();

// Get logging config
logsRouter.get('/config', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
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
});

// Update logging config
logsRouter.post('/config', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
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
});

// 1-Click Auto Setup channels in Discord
logsRouter.post('/auto-setup', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const guild = bot.guilds.cache.get(guildId);

  if (!guild) {
    return res.status(400).json({ error: 'Бот не подключен к серверу Discord' });
  }

  try {
    const result = await AuditLogger.setupLogChannels(guild);
    return res.json({ success: true, result });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default logsRouter;
