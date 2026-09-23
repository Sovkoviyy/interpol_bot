import { Router, Response } from 'express';
import { TextChannel } from 'discord.js';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { LeaveService } from '../../bot/modules/leave/leaveService';

const router = Router();

router.use(requireAuth);

function resolveGuildId(req: AuthenticatedRequest): string {
  const headerGuild = req.headers['x-guild-id'] as string;
  return headerGuild || req.user?.guildId || config.discord.guildId || 'default';
}

/**
 * GET /api/leave
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const status = req.query.status as string;
    const requests = await LeaveService.getAllRequests(guildId, status);
    res.json({ requests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/leave
 * Request a leave
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const userId = req.user?.userId || (req.user as any)?.id || 'unknown';
    const userTag = req.user?.username || 'Member';
    const { startDate, endDate, reason } = req.body;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'Заполните все поля заявки' });
    }

    const leave = await LeaveService.requestLeave(
      guildId,
      userId,
      userTag,
      new Date(startDate),
      new Date(endDate),
      reason
    );

    res.json({ leave });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/leave/:id/review
 */
router.post('/:id/review', requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId || (req.user as any)?.id || 'unknown';
    const userTag = req.user?.username || 'Reviewer';
    const { approved, rejectionReason } = req.body;

    const updated = await LeaveService.reviewLeave(
      String(req.params.id),
      userId,
      userTag,
      Boolean(approved),
      rejectionReason
    );

    res.json({ leave: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/leave/deploy-panel
 * Send interactive leave request message with button to Discord channel
 */
router.post('/deploy-panel', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Укажите ID текстового канала' });

    const guildId = resolveGuildId(req);
    if (!guildId || guildId === 'default') return res.status(400).json({ error: 'Сервер Discord не выбран' });

    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(400).json({ error: 'Бот не подключен к серверу Discord' });

    const channel = (guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Текстовый канал с таким ID не найден на сервере' });
    }

    const msg = await LeaveService.deployLeavePanel(channel);

    // Save as default in GuildConfig if configured
    await prisma.guildConfig.upsert({
      where: { guildId },
      update: { leaveRequestChannelId: channel.id },
      create: { guildId, leaveRequestChannelId: channel.id },
    }).catch(() => null);

    res.json({ success: true, messageId: msg.id, channelId: channel.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
