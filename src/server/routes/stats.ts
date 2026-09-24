import { Router, Response } from 'express';
import bot from '../../bot/client';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { resolveGuildId } from '../utils/guild';

export const statsRouter = Router();

// Helper to gather full stats data for a guild
async function getFullStatsData(guildId: string) {
  const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);

  // 1. Members count & Voice Activity
  const totalMembers = guild?.memberCount || 0;
  
  let onlineMembers = 0;
  let voiceOnline = 0;
  let botCount = 0;

  if (guild) {
    try {
      const fetchedMembers = await guild.members.fetch({ time: 5000 }).catch(() => guild.members.cache);
      for (const [, member] of fetchedMembers) {
        if (member.user.bot) botCount++;
        if (member.presence && member.presence.status !== 'offline') onlineMembers++;
        if (member.voice && member.voice.channelId) voiceOnline++;
      }
    } catch {
      // Fallback to cache if members.fetch times out
      for (const [, member] of guild.members.cache) {
        if (member.user.bot) botCount++;
        if (member.voice && member.voice.channelId) voiceOnline++;
      }
    }
  }

  const humanCount = Math.max(0, totalMembers - botCount);

  // 2. Recruitment stats
  const totalApplications = await prisma.recruitmentApplication.count({ where: { guildId } });
  const pendingApplications = await prisma.recruitmentApplication.count({
    where: { guildId, status: { in: ['PENDING', 'UNDER_REVIEW'] } },
  });
  const acceptedApplications = await prisma.recruitmentApplication.count({
    where: { guildId, status: 'ACCEPTED' },
  });
  const rejectedApplications = await prisma.recruitmentApplication.count({
    where: { guildId, status: 'REJECTED' },
  });

  // Recruiter leaderboard
  const allClosed = await prisma.recruitmentApplication.findMany({
    where: { guildId, status: { in: ['ACCEPTED', 'REJECTED'] }, recruiterId: { not: null } },
    select: { recruiterId: true, recruiterTag: true, status: true },
  });

  const recruiterMap: Record<string, { tag: string; accepted: number; rejected: number; total: number }> = {};
  for (const item of allClosed) {
    if (!item.recruiterId) continue;
    if (!recruiterMap[item.recruiterId]) {
      recruiterMap[item.recruiterId] = {
        tag: item.recruiterTag || item.recruiterId,
        accepted: 0,
        rejected: 0,
        total: 0,
      };
    }
    if (item.status === 'ACCEPTED') recruiterMap[item.recruiterId].accepted++;
    if (item.status === 'REJECTED') recruiterMap[item.recruiterId].rejected++;
    recruiterMap[item.recruiterId].total++;
  }

  const recruiterLeaderboard = Object.values(recruiterMap).sort((a, b) => b.total - a.total);

  // 3. Events stats
  const totalEvents = await prisma.eventGathering.count({ where: { guildId } });
  const activeEvents = await prisma.eventGathering.count({ where: { guildId, status: 'ACTIVE' } });
  const finishedEvents = await prisma.eventGathering.count({ where: { guildId, status: 'FINISHED' } });
  const totalTurnout = await prisma.eventParticipant.count({
    where: { event: { guildId } },
  });

  // 4. Role Persistence & Audit stats
  const savedRolesCount = await prisma.savedMemberRoles.count({ where: { guildId } });

  return {
    guild: {
      id: guildId,
      name: guild?.name || 'Сервер не подключен',
      icon: guild?.iconURL() || null,
      totalMembers,
      onlineMembers,
      humanCount,
      botCount,
      voiceOnline,
      channelsCount: guild?.channels.cache.size || 0,
      rolesCount: guild?.roles.cache.size || 0,
    },
    recruitment: {
      total: totalApplications,
      pending: pendingApplications,
      accepted: acceptedApplications,
      rejected: rejectedApplications,
      approvalRate: (acceptedApplications + rejectedApplications) > 0 
        ? Math.round((acceptedApplications / (acceptedApplications + rejectedApplications)) * 100) 
        : 0,
      leaderboard: recruiterLeaderboard,
    },
    events: {
      total: totalEvents,
      active: activeEvents,
      finished: finishedEvents,
      totalTurnout,
    },
    system: {
      savedRolesProfiles: savedRolesCount,
      timestamp: new Date().toISOString(),
    },
  };
}

// In-memory cache to prevent Discord Gateway / DB overload
const statsCache = new Map<string, { data: any; cachedAt: number }>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

async function getCachedStatsData(guildId: string, forceFresh = false) {
  const now = Date.now();
  const cached = statsCache.get(guildId);
  if (!forceFresh && cached && (now - cached.cachedAt) < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await getFullStatsData(guildId);
  statsCache.set(guildId, { data, cachedAt: now });
  return data;
}

// Dashboard internal stats endpoint
statsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const data = await getCachedStatsData(guildId, true);
  return res.json(data);
});

export default statsRouter;
