import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import config from '../../config';
import prisma from '../../database/client';
import { ProfileService } from '../../bot/modules/profiles/profileService';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/profiles
 * List profiles with search and filter
 */
router.get('/', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
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
router.get('/leaderboard', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
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
router.get('/:userId', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const profile = await ProfileService.getOrCreateProfile(guildId, req.params.userId);
    res.json({ profile });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/profiles/:userId/static
 */
router.post('/:userId/static', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const { staticId, characterName } = req.body;
    if (!staticId) return res.status(400).json({ error: 'Укажите Static ID' });

    const updated = await ProfileService.setStatic(
      guildId,
      req.params.userId,
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
router.post('/:userId/penalty', async (req, res) => {
  try {
    const guildId = config.discord.guildId || 'default';
    const { count, reason } = req.body;
    const penaltyCount = parseInt(count, 10) || 1;

    const updated = await ProfileService.addPenaltyMp(
      guildId,
      req.params.userId,
      penaltyCount,
      reason
    );

    res.json({ profile: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
