import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { AcademyService } from '../../bot/modules/academy/academyService';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/academy/config
 */
router.get('/config', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const academyConfig = await AcademyService.getConfig(guildId);
    res.json({ config: academyConfig });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/academy/config
 */
router.post('/config', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const updated = await AcademyService.saveConfig(guildId, req.body);
    res.json({ config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/academy/channels
 */
router.get('/channels', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
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
router.get('/reports', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
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
router.post('/reports/:id/review', async (req, res) => {
  try {
    const { approved, rejectionReason } = req.body;
    const reportId = req.params.id;

    const guildId = config.discord.guildId;
    if (!guildId) return res.status(400).json({ error: 'GUILD_ID не настроен' });

    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const user: any = (req as any).user;
    const reviewerMember = await guild.members.fetch(user.id).catch(() => null);
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
router.post('/channels/:id/promote', async (req, res) => {
  try {
    const { approved, rejectionReason, penaltyMp } = req.body;
    const channelId = req.params.id;

    const guildId = config.discord.guildId;
    if (!guildId) return res.status(400).json({ error: 'GUILD_ID не настроен' });

    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу' });

    const user: any = (req as any).user;
    const reviewerMember = await guild.members.fetch(user.id).catch(() => null);
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
