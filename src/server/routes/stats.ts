import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { ChannelType } from 'discord.js';
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

// Simple in-memory rate limiter: max 60 req/min per IP/Key
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(clientIdentifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientIdentifier);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(clientIdentifier, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (record.count >= 60) {
    return false;
  }
  record.count++;
  return true;
}

// 1. Dashboard internal stats endpoint
statsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const data = await getCachedStatsData(guildId, true); // internal dashboard gets fresh data

  const guildConfig = await prisma.guildConfig.findUnique({
    where: { guildId },
    select: { statsApiKey: true },
  });

  return res.json({
    ...data,
    apiKey: guildConfig?.statsApiKey || null,
  });
});

// 2. Generate/Regenerate API Key for external access
statsRouter.post('/api-key/generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const newApiKey = 'interpol_' + crypto.randomBytes(24).toString('hex');

  await prisma.guildConfig.upsert({
    where: { guildId },
    update: { statsApiKey: newApiKey },
    create: { guildId, statsApiKey: newApiKey },
  });

  return res.json({ success: true, apiKey: newApiKey });
});

// 3. External API endpoint (authenticated via X-API-Key, Bearer token, or query param)
statsRouter.get('/external', async (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const apiKey = (req.headers['x-api-key'] || req.query.api_key || req.headers.authorization?.replace(/^Bearer\s+/i, '')) as string;

  if (!checkRateLimit(apiKey || clientIp)) {
    return res.status(429).json({ error: 'Too Many Requests: Rate limit exceeded (60 req/min)' });
  }

  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) {
    return res.status(401).json({
      error: 'Unauthorized: missing or invalid API key format',
      usage: 'Pass your API key in header "X-API-Key: <key>" or query param "?api_key=<key>"',
    });
  }

  // Find guild with this API key
  const guildConfig = await prisma.guildConfig.findFirst({
    where: { statsApiKey: apiKey },
  });

  // If no guild matches directly, check if it matches .env fallback
  let targetGuildId = guildConfig?.guildId;
  if (!targetGuildId && process.env.STATS_API_KEY && process.env.STATS_API_KEY === apiKey) {
    targetGuildId = config.discord.guildId;
  }

  if (!targetGuildId) {
    return res.status(403).json({ error: 'Forbidden: Invalid API key' });
  }

  const data = await getCachedStatsData(targetGuildId);
  return res.json({
    success: true,
    data,
  });
});

export default statsRouter;
