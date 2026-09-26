import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { TierService } from '../../bot/modules/tier/tierService';
import { resolveGuildId, getDiscordGuild } from '../utils/guild';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/tier/config
 */
router.get('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const tierConfig = await TierService.getConfig(guildId);
    res.json({ config: tierConfig });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tier/config
 */
router.post('/config', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const { categoryId, applyChannelId, reviewChannelId, checkerRoleId, enabled } = req.body;

    const updated = await prisma.tierConfig.upsert({
      where: { guildId },
      update: {
        ...(categoryId !== undefined && { categoryId }),
        ...(applyChannelId !== undefined && { applyChannelId }),
        ...(reviewChannelId !== undefined && { reviewChannelId }),
        ...(checkerRoleId !== undefined && { checkerRoleId }),
        ...(enabled !== undefined && { enabled: Boolean(enabled) }),
      },
      create: {
        guildId,
        categoryId: categoryId || null,
        applyChannelId: applyChannelId || null,
        reviewChannelId: reviewChannelId || null,
        checkerRoleId: checkerRoleId || null,
        enabled: enabled !== undefined ? Boolean(enabled) : true,
      },
    });

    res.json({ config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tier/setup
 * Automatically provision category, channels, and checker role in Discord
 */
router.post('/setup', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const guild = await getDiscordGuild(guildId);
    if (!guild) {
      return res.status(400).json({ error: 'Сервер Discord не подключен' });
    }

    const result = await TierService.setupTierStructure(guild);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tier/tickets
 */
router.get('/tickets', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const tickets = await prisma.tierTicket.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      include: {
        submissions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    res.json({ tickets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tier/submissions
 */
router.get('/submissions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const { status, mpType } = req.query;

    const where: any = { guildId };
    if (status && typeof status === 'string') {
      where.status = status;
    }
    if (mpType && typeof mpType === 'string') {
      where.mpType = mpType;
    }

    const submissions = await prisma.tierSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        ticket: true,
      },
    });

    res.json({ submissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
