import { Router, Response } from 'express';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { resolveGuildId, getDiscordGuild } from '../utils/guild';
import { ProfileService } from '../../bot/modules/profiles/profileService';
import { NicknameService } from '../../bot/modules/nicknames/nicknameService';

export const guildRouter = Router();

// Get guild roles
guildRouter.get('/roles', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const guild = await getDiscordGuild(guildId);

  if (!guild) {
    return res.json({ roles: [] });
  }

  const botMember = guild.members.me;
  const botHighestRolePos = botMember?.roles.highest.position ?? 0;

  const roles = guild.roles.cache
    .filter(r => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position)
    .map(r => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      position: r.position,
      manageable: r.editable && r.position < botHighestRolePos,
    }));

  return res.json({ roles });
});

// Get guild channels
guildRouter.get('/channels', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const guild = await getDiscordGuild(guildId);

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
  const guildId = resolveGuildId(req);
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
      restoreNicknamesOnJoin: true,
    },
  });
});

// Update guild general config
guildRouter.post('/config', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const { recruitmentEnabled, eventsEnabled, loggingEnabled, restoreRolesOnJoin, restoreNicknamesOnJoin } = req.body;

  const updated = await prisma.guildConfig.upsert({
    where: { guildId: guildId || 'default' },
    update: {
      recruitmentEnabled: Boolean(recruitmentEnabled),
      eventsEnabled: Boolean(eventsEnabled),
      loggingEnabled: Boolean(loggingEnabled),
      restoreRolesOnJoin: restoreRolesOnJoin !== undefined ? Boolean(restoreRolesOnJoin) : true,
      restoreNicknamesOnJoin: restoreNicknamesOnJoin !== undefined ? Boolean(restoreNicknamesOnJoin) : true,
    },
    create: {
      guildId: guildId || 'default',
      recruitmentEnabled: Boolean(recruitmentEnabled),
      eventsEnabled: Boolean(eventsEnabled),
      loggingEnabled: Boolean(loggingEnabled),
      restoreRolesOnJoin: restoreRolesOnJoin !== undefined ? Boolean(restoreRolesOnJoin) : true,
      restoreNicknamesOnJoin: restoreNicknamesOnJoin !== undefined ? Boolean(restoreNicknamesOnJoin) : true,
    },
  });

  return res.json({ success: true, config: updated });
});

// Get all guild members with rich metadata, Discord roles, invite info, and in-game profiles
guildRouter.get('/members', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
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

  const [trackedInvites, profiles] = await Promise.all([
    prisma.memberInviteTracking.findMany({ where: { guildId } }).catch(() => []),
    prisma.userProfile.findMany({ where: { guildId }, include: { characters: true } }).catch(() => []),
  ]);

  const inviteMap = new Map<string, { inviteCode: string | null; inviterTag: string | null; inviterId: string | null }>();
  for (const inv of trackedInvites) {
    inviteMap.set(inv.userId, {
      inviteCode: inv.inviteCode,
      inviterTag: inv.inviterTag,
      inviterId: inv.inviterId,
    });
  }

  const profileMap = new Map<string, any>();
  for (const p of profiles) {
    profileMap.set(p.userId, p);
  }

  const botMember = guild.members.me;
  const botHighestRolePos = botMember?.roles.highest.position ?? 0;

  const memberList = Array.from(membersCollection.values()).map(m => {
    const roles = m.roles.cache
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position,
        manageable: r.editable && r.position < botHighestRolePos,
      }));

    const invite = inviteMap.get(m.id) || null;
    const profile = profileMap.get(m.id) || null;

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
      manageable: m.manageable,
      roles,
      voiceChannel: m.voice?.channel ? { id: m.voice.channel.id, name: m.voice.channel.name } : null,
      invite,
      profile: profile ? {
        id: profile.id,
        staticId: profile.staticId || null,
        characterName: profile.characterName || null,
        rank: profile.rank || 1,
        status: profile.status || 'ACTIVE',
        mpCount: profile.mpCount || 0,
        notes: profile.notes || null,
        characters: profile.characters || [],
      } : null,
    };
  });

  return res.json({ members: memberList });
});

// Update member in-game profile (staticId, characterName, rank, status, notes)
guildRouter.put('/members/:userId/profile', requireAuth, requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const userId = req.params.userId as string;
  const { staticId, characterName, rank, status, notes, syncNickname } = req.body;

  try {
    const guild = await getDiscordGuild(guildId);
    let userTag = '';
    let member: any = null;

    if (guild) {
      member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
      if (member) {
        userTag = member.user.tag;
      }
    }

    const cleanStatic = staticId !== undefined ? (staticId ? String(staticId).trim() : null) : undefined;
    const cleanCharName = characterName !== undefined ? (characterName ? String(characterName).trim() : null) : undefined;

    const profile = await prisma.userProfile.upsert({
      where: {
        guildId_userId: { guildId, userId },
      },
      update: {
        ...(cleanStatic !== undefined ? { staticId: cleanStatic } : {}),
        ...(cleanCharName !== undefined ? { characterName: cleanCharName } : {}),
        ...(rank !== undefined ? { rank: Number(rank) } : {}),
        ...(status !== undefined ? { status: String(status) } : {}),
        ...(notes !== undefined ? { notes: String(notes) } : {}),
        ...(userTag ? { userTag } : {}),
      },
      create: {
        guildId,
        userId,
        userTag: userTag || undefined,
        staticId: cleanStatic || null,
        characterName: cleanCharName || null,
        rank: rank ? Number(rank) : 1,
        status: status ? String(status) : 'ACTIVE',
        notes: notes ? String(notes) : null,
      },
    });

    // If characterName or static changed, add to UserCharacter history if not already present
    if (cleanCharName || cleanStatic) {
      const existingChar = await prisma.userCharacter.findFirst({
        where: {
          profileId: profile.id,
          characterName: cleanCharName || profile.characterName || 'Неизвестно',
        },
      });

      if (!existingChar && cleanCharName) {
        await prisma.userCharacter.create({
          data: {
            profileId: profile.id,
            characterName: cleanCharName,
            staticId: cleanStatic || profile.staticId || '0',
            isMain: true,
          },
        }).catch(() => null);
      }
    }

    // Synchronize Discord nickname if requested and manageable
    let nicknameUpdated = false;
    let newNickname = '';
    if (syncNickname && member && member.manageable) {
      const charName = cleanCharName ?? profile.characterName ?? '';
      const stat = cleanStatic ?? profile.staticId ?? '';
      if (charName && stat) {
        newNickname = `${charName} | ${stat}`.slice(0, 32);
      } else if (charName) {
        newNickname = charName.slice(0, 32);
      }

      if (newNickname) {
        await member.setNickname(newNickname, 'Синхронизация ника через веб-панель').catch((e: any) => {
          console.warn('[guildRouter] Error setting nickname:', e.message);
        });
        nicknameUpdated = true;
      }
    }

    return res.json({
      success: true,
      profile,
      nicknameUpdated,
      newNickname: nicknameUpdated ? newNickname : undefined,
    });
  } catch (err: any) {
    console.error('[guildRouter] Error updating member profile:', err);
    return res.status(500).json({ error: err.message || 'Ошибка обновления профиля' });
  }
});

// Update Discord roles for a member
guildRouter.put('/members/:userId/roles', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const userId = req.params.userId as string;
  const { roleIds, action, roleId } = req.body;

  try {
    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(404).json({ error: 'Сервер Discord не найден' });

    const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Участник не найден на сервере' });

    const botMember = guild.members.me;
    const botHighestRolePos = botMember?.roles.highest.position ?? 0;

    // Single role add or remove
    if (action && roleId) {
      const targetRole = guild.roles.cache.get(roleId);
      if (!targetRole) return res.status(404).json({ error: 'Роль не найдена' });

      if (targetRole.position >= botHighestRolePos) {
        return res.status(403).json({ error: `Роль @${targetRole.name} выше роли бота в Discord и не может быть изменена` });
      }

      if (action === 'add') {
        await member.roles.add(roleId, 'Выдача роли через веб-панель');
      } else if (action === 'remove') {
        await member.roles.remove(roleId, 'Снятие роли через веб-панель');
      }

      const updatedRoles = member.roles.cache
        .filter(r => r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map(r => ({
          id: r.id,
          name: r.name,
          color: r.hexColor,
          position: r.position,
        }));

      return res.json({ success: true, roles: updatedRoles });
    }

    // Batch set roles
    if (Array.isArray(roleIds)) {
      // Retain roles that the bot cannot manage so we don't accidentally remove them
      const unmanageableRoles = member.roles.cache
        .filter(r => r.name !== '@everyone' && r.position >= botHighestRolePos)
        .map(r => r.id);

      // Filter requested roles to only manageable ones
      const validRequestedRoles = roleIds.filter(id => {
        const r = guild.roles.cache.get(id);
        return r && r.position < botHighestRolePos;
      });

      const finalRoleIds = Array.from(new Set([...unmanageableRoles, ...validRequestedRoles]));
      await member.roles.set(finalRoleIds, 'Обновление ролей через веб-панель');

      const updatedRoles = member.roles.cache
        .filter(r => r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map(r => ({
          id: r.id,
          name: r.name,
          color: r.hexColor,
          position: r.position,
        }));

      return res.json({ success: true, roles: updatedRoles });
    }

    return res.status(400).json({ error: 'Не указаны roleIds или action' });
  } catch (err: any) {
    console.error('[guildRouter] Error updating member roles:', err);
    return res.status(500).json({ error: err.message || 'Ошибка обновления ролей' });
  }
});

// Update member Discord server nickname directly
guildRouter.put('/members/:userId/nickname', requireAuth, requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const userId = req.params.userId as string;
  const { nickname } = req.body;

  try {
    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(404).json({ error: 'Сервер Discord не найден' });

    const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Участник не найден' });

    if (!member.manageable) {
      return res.status(403).json({ error: 'Бот не может изменить никнейм этому пользователю (он является владельцем сервера или имеет более высокую роль)' });
    }

    const cleanNick = (nickname || '').trim().slice(0, 32);
    await member.setNickname(cleanNick || null, 'Изменение ника через веб-панель');

    return res.json({ success: true, nickname: cleanNick });
  } catch (err: any) {
    console.error('[guildRouter] Error updating nickname:', err);
    return res.status(500).json({ error: err.message || 'Ошибка изменения никнейма' });
  }
});

// Auto-sync nickname to family format (CharacterName | StaticId)
guildRouter.post('/members/:userId/sync-nickname', requireAuth, requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const userId = req.params.userId as string;

  try {
    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(404).json({ error: 'Сервер Discord не найден' });

    const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Участник не найден' });

    if (!member.manageable) {
      return res.status(403).json({ error: 'Бот не может изменить никнейм этому пользователю из-за иерархии ролей Discord' });
    }

    const profile = await prisma.userProfile.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!profile || (!profile.characterName && !profile.staticId)) {
      return res.status(400).json({ error: 'У участника не указаны игровой ник или статик в профиле' });
    }

    let targetNick = '';
    if (profile.characterName && profile.staticId) {
      targetNick = `${profile.characterName} | ${profile.staticId}`;
    } else if (profile.characterName) {
      targetNick = profile.characterName;
    } else if (profile.staticId) {
      targetNick = `${member.user.username} | ${profile.staticId}`;
    }

    targetNick = targetNick.slice(0, 32);
    await member.setNickname(targetNick, 'Авто-синхронизация ника по стандарту семьи');

    return res.json({ success: true, nickname: targetNick });
  } catch (err: any) {
    console.error('[guildRouter] Error syncing nickname:', err);
    return res.status(500).json({ error: err.message || 'Ошибка синхронизации никнейма' });
  }
});

export default guildRouter;
