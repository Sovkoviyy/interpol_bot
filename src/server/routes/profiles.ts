import { Router, Response } from 'express';
import { TextChannel } from 'discord.js';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { ProfileService } from '../../bot/modules/profiles/profileService';

const router = Router();

router.use(requireAuth);

function resolveGuildId(req: AuthenticatedRequest): string {
  const headerGuild = req.headers['x-guild-id'] as string;
  return headerGuild || req.user?.guildId || config.discord.guildId || 'default';
}

/**
 * GET /api/profiles
 * List profiles with search and filter
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const search = req.query.search as string;

    const profiles = search
      ? await ProfileService.searchProfiles(guildId, search)
      : await prisma.userProfile.findMany({
          where: { guildId },
          orderBy: { mpCount: 'desc' },
          take: 50,
        });

    res.json({ profiles });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/profiles/leaderboard
 */
router.get('/leaderboard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const topMp = await ProfileService.getTopByMp(guildId, 10);
    const topVoice = await ProfileService.getTopByVoice(guildId, 10);

    res.json({ topMp, topVoice });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/profiles/:userId
 */
router.get('/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const profile = await ProfileService.getOrCreateProfile(guildId, String(req.params.userId));
    res.json({ profile });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/profiles/:userId/static
 */
router.post('/:userId/static', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authUser = req.user;
    const targetUserId = String(req.params.userId);
    const isSelf = authUser?.userId === targetUserId;
    const hasPerm = authUser?.permissions.isAdmin || authUser?.permissions.manageSettings || authUser?.permissions.manageRecruiting;

    if (!isSelf && !hasPerm) {
      return res.status(403).json({ error: 'Forbidden: You cannot modify another member\'s profile' });
    }

    const guildId = resolveGuildId(req);
    const { staticId, characterName } = req.body;
    if (!staticId) return res.status(400).json({ error: 'Укажите Static ID' });

    const updated = await ProfileService.setStatic(
      guildId,
      targetUserId,
      staticId,
      characterName
    );

    res.json({ profile: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/profiles/:userId/penalty
 */
router.post('/:userId/penalty', requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const { count, reason } = req.body;
    const penaltyCount = parseInt(count, 10) || 1;

    const updated = await ProfileService.addPenaltyMp(
      guildId,
      String(req.params.userId),
      penaltyCount,
      reason
    );

    res.json({ profile: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/profiles/deploy-panel
 * Send interactive static binding message to Discord channel
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

    const msg = await ProfileService.deployStaticBindingPanel(channel);

    // Save as default in GuildConfig if configured
    await prisma.guildConfig.upsert({
      where: { guildId },
      update: { staticBindingChannelId: channel.id },
      create: { guildId, staticBindingChannelId: channel.id },
    }).catch(() => null);

    res.json({ success: true, messageId: msg.id, channelId: channel.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
