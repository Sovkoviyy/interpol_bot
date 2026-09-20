import { Router, Response } from 'express';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';

export const statsRouter = Router();

statsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;
  const guild = bot.guilds.cache.get(guildId);

  // 1. Members count
  const totalMembers = guild?.memberCount || 0;

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

  return res.json({
    guild: {
      name: guild?.name || 'Сервер не подключен',
      icon: guild?.iconURL() || null,
      totalMembers,
    },
    recruitment: {
      total: totalApplications,
      pending: pendingApplications,
      accepted: acceptedApplications,
      rejected: rejectedApplications,
      leaderboard: recruiterLeaderboard,
    },
    events: {
      total: totalEvents,
      active: activeEvents,
      finished: finishedEvents,
    },
  });
});

export default statsRouter;
