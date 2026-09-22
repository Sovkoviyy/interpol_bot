import { Router, Response } from 'express';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';

export const guildRouter = Router();

// Get guild roles
guildRouter.get('/roles', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;
  const guild = bot.guilds.cache.get(guildId);

  if (!guild) {
    return res.json({ roles: [] });
  }

  const roles = guild.roles.cache
    .filter(r => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position)
    .map(r => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      position: r.position,
    }));

  return res.json({ roles });
});

// Get guild channels
guildRouter.get('/channels', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;
  const guild = bot.guilds.cache.get(guildId);

  if (!guild) {
    return res.json({ channels: [] });
  }

  const channels = guild.channels.cache
    .map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId,
    }));

  return res.json({ channels });
});

// Get guild general config
guildRouter.get('/config', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;
  const guildConfig = await prisma.guildConfig.findUnique({
    where: { guildId: guildId || 'default' },
  });

  return res.json({
    config: guildConfig || {
      guildId,
      recruitmentEnabled: true,
      eventsEnabled: true,
      loggingEnabled: true,
      restoreRolesOnJoin: true,
    },
  });
});

// Update guild general config
guildRouter.post('/config', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;
  const { recruitmentEnabled, eventsEnabled, loggingEnabled, restoreRolesOnJoin } = req.body;

  const updated = await prisma.guildConfig.upsert({
    where: { guildId: guildId || 'default' },
    update: {
      recruitmentEnabled: Boolean(recruitmentEnabled),
      eventsEnabled: Boolean(eventsEnabled),
      loggingEnabled: Boolean(loggingEnabled),
      restoreRolesOnJoin: restoreRolesOnJoin !== undefined ? Boolean(restoreRolesOnJoin) : true,
    },
    create: {
      guildId: guildId || 'default',
      recruitmentEnabled: Boolean(recruitmentEnabled),
      eventsEnabled: Boolean(eventsEnabled),
      loggingEnabled: Boolean(loggingEnabled),
      restoreRolesOnJoin: restoreRolesOnJoin !== undefined ? Boolean(restoreRolesOnJoin) : true,
    },
  });

  return res.json({ success: true, config: updated });
});

export default guildRouter;
