import { Router, Response } from 'express';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { AuditLogger } from '../../bot/modules/logging/auditLogger';
import { resolveGuildId, getDiscordGuild } from '../utils/guild';

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
});

/**
 * GET /api/logs/entries
 * Returns combined audit logs (Discord server audit logs + internal Bot action logs)
 */
logsRouter.get('/entries', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const actionFilter = (req.query.action as string) || 'ALL';
    const limit = Math.min(150, parseInt(req.query.limit as string, 10) || 100);

    // 1. Fetch DB Bot Logs
    const dbLogs = await prisma.auditLogEntry.findMany({
      where: {
        guildId,
        ...(actionFilter !== 'ALL' ? { action: actionFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const formattedBotLogs = dbLogs.map((log) => ({
      id: log.id,
      source: 'BOT',
      category: log.category,
      action: log.action,
      executorId: log.executorId,
      executorTag: log.executorTag || log.executorId || 'Система',
      targetId: log.targetId,
      details: log.description || log.title,
      title: log.title,
      createdAt: log.createdAt,
    }));

    // 2. Fetch Native Discord Audit Logs
    const guild = await getDiscordGuild(guildId);
    const discordLogs: any[] = [];

    if (guild) {
      try {
        const audit = await guild.fetchAuditLogs({ limit: 50 });
        for (const entry of audit.entries.values()) {
          let actionName = 'DISCORD_ACTION';
          let category = 'DISCORD';
          let details = '';

          // Determine action type from Discord AuditLogEvent
          const actionType = entry.action;
          if (actionType === 10) {
            actionName = 'CHANNEL_CREATE';
            category = 'CHANNELS';
            details = `Создан канал: #${(entry.target as any)?.name || entry.targetId}`;
          } else if (actionType === 12) {
            actionName = 'CHANNEL_DELETE';
            category = 'CHANNELS';
            details = `Удален канал: #${(entry.target as any)?.name || entry.targetId}`;
          } else if (actionType === 11) {
            actionName = 'CHANNEL_UPDATE';
            category = 'CHANNELS';
            details = `Изменен канал: #${(entry.target as any)?.name || entry.targetId}`;
          } else if (actionType === 20) {
            actionName = 'MEMBER_KICK';
            category = 'MEMBERS';
            details = `Кикнут участник: ${(entry.target as any)?.tag || (entry.target as any)?.username || entry.targetId}${entry.reason ? `. Причина: ${entry.reason}` : ''}`;
          } else if (actionType === 22) {
            actionName = 'MEMBER_BAN';
            category = 'MEMBERS';
            details = `Забанен участник: ${(entry.target as any)?.tag || (entry.target as any)?.username || entry.targetId}${entry.reason ? `. Причина: ${entry.reason}` : ''}`;
          } else if (actionType === 23) {
            actionName = 'MEMBER_UNBAN';
            category = 'MEMBERS';
            details = `Разбанен участник: ${(entry.target as any)?.tag || (entry.target as any)?.username || entry.targetId}`;
          } else if (actionType === 25) {
            actionName = 'ROLE_UPDATE';
            category = 'ROLES';
            const changes = entry.changes.map(c => `${c.key}: ${JSON.stringify(c.new || c.old)}`).join(', ');
            details = `Обновлены роли участника: ${changes}`;
          } else if (actionType === 30) {
            actionName = 'ROLE_CREATE';
            category = 'ROLES';
            details = `Создана роль: @${(entry.target as any)?.name || entry.targetId}`;
          } else if (actionType === 32) {
            actionName = 'ROLE_DELETE';
            category = 'ROLES';
            details = `Удалена роль: @${(entry.target as any)?.name || entry.targetId}`;
          } else if (actionType === 72) {
            actionName = 'MESSAGE_DELETE';
            category = 'MESSAGES';
            details = `Удалено сообщение в канале ${(entry.extra as any)?.channel?.name ? `#${(entry.extra as any)?.channel?.name}` : ''}`;
          } else {
            actionName = `DISCORD_${entry.action}`;
            details = `Действие в Discord (Event #${entry.action})`;
          }

          if (actionFilter === 'ALL' || actionFilter === actionName) {
            discordLogs.push({
              id: `discord_${entry.id}`,
              source: 'DISCORD',
              category,
              action: actionName,
              executorId: entry.executorId,
              executorTag: entry.executor?.tag || entry.executor?.username || entry.executorId || 'Discord',
              targetId: entry.targetId,
              targetTag: (entry.target as any)?.tag || (entry.target as any)?.name || entry.targetId,
              details,
              createdAt: entry.createdAt,
            });
          }
        }
      } catch (auditErr: any) {
        // Bot might lack VIEW_AUDIT_LOG permission; fallback gracefully
        console.warn('Could not fetch Discord audit logs:', auditErr.message);
      }
    }

    // 3. Merge & Sort by date descending
    let combined = [...formattedBotLogs, ...discordLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // 4. Apply text search if specified
    if (search) {
      combined = combined.filter((item) => {
        const textToSearch = `${item.action} ${item.executorTag} ${item.executorId} ${item.targetTag || ''} ${item.details || ''} ${item.category}`.toLowerCase();
        return textToSearch.includes(search);
      });
    }

    return res.json({ entries: combined.slice(0, limit) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default logsRouter;

