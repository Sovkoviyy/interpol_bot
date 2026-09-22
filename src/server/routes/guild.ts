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

// Get all guild members with rich metadata, roles, invite info
guildRouter.get('/members', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;
  const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);

  if (!guild) {
    return res.json({ members: [] });
  }

  let membersCollection = guild.members.cache;
  try {
    membersCollection = await guild.members.fetch({ time: 8000 });
  } catch {
    membersCollection = guild.members.cache;
  }

  const trackedInvites = await prisma.memberInviteTracking.findMany({
    where: { guildId },
  }).catch(() => []);

  const inviteMap = new Map<string, { inviteCode: string | null; inviterTag: string | null; inviterId: string | null }>();
  for (const inv of trackedInvites) {
    inviteMap.set(inv.userId, {
      inviteCode: inv.inviteCode,
      inviterTag: inv.inviterTag,
      inviterId: inv.inviterId,
    });
  }

  const memberList = Array.from(membersCollection.values()).map(m => {
    const roles = m.roles.cache
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position,
      }));

    const invite = inviteMap.get(m.id) || null;

    return {
      id: m.id,
      username: m.user.username,
      discriminator: m.user.discriminator,
      tag: m.user.tag,
      nickname: m.nickname,
      displayName: m.displayName,
      avatar: m.user.displayAvatarURL({ size: 128 }),
      joinedAt: m.joinedAt?.toISOString() || null,
      createdAt: m.user.createdAt.toISOString(),
      isBot: m.user.bot,
      roles,
      voiceChannel: m.voice?.channel ? { id: m.voice.channel.id, name: m.voice.channel.name } : null,
      invite,
    };
  });

  return res.json({ members: memberList });
});

export default guildRouter;
