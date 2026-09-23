import { Router } from 'express';
import { TextChannel } from 'discord.js';
import { requireAuth } from '../middlewares/auth';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { LeaveService } from '../../bot/modules/leave/leaveService';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/leave
 */
router.get('/', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
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
router.post('/', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const user: any = (req as any).user;
    const { startDate, endDate, reason } = req.body;

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'Заполните все поля заявки' });
    }

    const leave = await LeaveService.requestLeave(
      guildId,
      user.id,
      user.tag || user.username,
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
router.post('/:id/review', async (req, res) => {
  try {
    const user: any = (req as any).user;
    const { approved, rejectionReason } = req.body;

    const updated = await LeaveService.reviewLeave(
      req.params.id,
      user.id,
      user.tag || user.username,
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
router.post('/deploy-panel', async (req, res) => {
  try {
    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Укажите ID текстового канала' });

    const guildId = config.discord.guildId;
    if (!guildId) return res.status(400).json({ error: 'GUILD_ID не настроен' });

    const guild = bot.guilds.cache.get(guildId);
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
