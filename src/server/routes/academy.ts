import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { AcademyService } from '../../bot/modules/academy/academyService';

const router = Router();

router.use(requireAuth);

function resolveGuildId(req: AuthenticatedRequest): string {
  const headerGuild = req.headers['x-guild-id'] as string;
  return headerGuild || req.user?.guildId || config.discord.guildId || 'default';
}

/**
 * GET /api/academy/config
 */
router.get('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const academyConfig = await AcademyService.getConfig(guildId);
    res.json({ config: academyConfig });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/academy/config
 */
router.post('/config', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const updated = await AcademyService.saveConfig(guildId, req.body);
    res.json({ config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/academy/channels
 */
router.get('/channels', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const channels = await prisma.academyChannel.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      include: {
        reports: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    res.json({ channels });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/academy/reports
 */
router.get('/reports', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const status = req.query.status as string;

    const reports = await prisma.mpReport.findMany({
      where: {
        guildId,
        ...(status && status !== 'ALL' ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ reports });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/academy/reports/:id/review
 */
router.post('/reports/:id/review', requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { approved, rejectionReason } = req.body;
    const reportId = String(req.params.id);

    const guildId = resolveGuildId(req);
    if (!guildId || guildId === 'default') return res.status(400).json({ error: 'Сервер Discord не выбран' });

    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const userId = req.user?.userId || (req.user as any)?.id;
    const reviewerMember = userId ? await guild.members.fetch(userId).catch(() => null) : null;
    if (!reviewerMember) return res.status(400).json({ error: 'Рекрутер не найден на сервере' });

    const reviewed = await AcademyService.reviewReport(
      reportId,
      reviewerMember,
      Boolean(approved),
      rejectionReason
    );

    res.json({ report: reviewed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/academy/channels/:id/promote
 */
router.post('/channels/:id/promote', requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { approved, rejectionReason, penaltyMp } = req.body;
    const channelId = String(req.params.id);

    const guildId = resolveGuildId(req);
    if (!guildId || guildId === 'default') return res.status(400).json({ error: 'Сервер Discord не выбран' });

    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const userId = req.user?.userId || (req.user as any)?.id;
    const reviewerMember = userId ? await guild.members.fetch(userId).catch(() => null) : null;
    if (!reviewerMember) return res.status(400).json({ error: 'Рекрутер не найден на сервере' });

    await AcademyService.promoteAcademician(
      channelId,
      reviewerMember,
      Boolean(approved),
      rejectionReason,
      penaltyMp ? parseInt(penaltyMp, 10) : undefined
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
