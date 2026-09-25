import { Router, Response } from 'express';
import { TextChannel } from 'discord.js';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import config from '../../config';
import prisma from '../../database/client';
import bot from '../../bot/client';
import { ProfileService } from '../../bot/modules/profiles/profileService';
import { ServerSetupService } from '../../bot/modules/setup/serverSetupService';
import { AuditLogger } from '../../bot/modules/logging/auditLogger';
import { resolveGuildId } from '../utils/guild';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/profiles
 * List profiles with search, sorting, and aggregate statistics
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const search = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || 'mpCount';
    const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

    // Allowable sort fields
    const validSortFields = ['mpCount', 'voiceSeconds', 'penaltyMp', 'rank', 'createdAt', 'userTag'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'mpCount';

    let profiles = search
      ? await ProfileService.searchProfiles(guildId, search)
      : await prisma.userProfile.findMany({
          where: { guildId },
          orderBy: { [orderByField]: order },
          include: { characters: { orderBy: { createdAt: 'asc' } } },
          take: 100,
        });

    if (search && orderByField) {
      // Sort in-memory if search results
      profiles.sort((a: any, b: any) => {
        const valA = a[orderByField] ?? 0;
        const valB = b[orderByField] ?? 0;
        if (order === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });
    }

    // Stats
    const totalCount = await prisma.userProfile.count({ where: { guildId } });
    const withStatics = await prisma.userProfile.count({
      where: {
        guildId,
        staticId: { not: null },
      },
    });
    const withoutStatics = totalCount - withStatics;
    const activeCount = await prisma.userProfile.count({
      where: { guildId, status: 'ACTIVE' },
    });
    const onLeaveCount = await prisma.userProfile.count({
      where: { guildId, status: 'ON_LEAVE' },
    });

    res.json({
      profiles,
      totalCount,
      stats: {
        total: totalCount,
        withStatics,
        withoutStatics,
        active: activeCount,
        onLeave: onLeaveCount,
      },
    });
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
    const topMp = await prisma.userProfile.findMany({
      where: { guildId },
      orderBy: { mpCount: 'desc' },
      include: { characters: { orderBy: { createdAt: 'asc' } } },
      take: 10,
    });
    const topVoice = await prisma.userProfile.findMany({
      where: { guildId },
      orderBy: { voiceSeconds: 'desc' },
      include: { characters: { orderBy: { createdAt: 'asc' } } },
      take: 10,
    });

    res.json({ topMp, topVoice });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/profiles/manual
 * Manually create or update member profile with up to 3 characters
 */
router.post('/manual', requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const { userId, userTag, rank, notes, status, characters } = req.body;

    if (!userId || String(userId).trim() === '') {
      return res.status(400).json({ error: 'Укажите Discord User ID' });
    }

    const cleanUserId = String(userId).trim();
    const cleanUserTag = userTag?.trim() || `User_${cleanUserId.slice(-4)}`;

    // Ensure profile exists
    let profile = await prisma.userProfile.findUnique({
      where: { guildId_userId: { guildId, userId: cleanUserId } },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          guildId,
          userId: cleanUserId,
          userTag: cleanUserTag,
          rank: parseInt(rank, 10) || 1,
          status: status || 'ACTIVE',
          notes: notes || null,
        },
      });
    } else {
      profile = await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          userTag: cleanUserTag,
          rank: rank ? parseInt(rank, 10) : profile.rank,
          status: status || profile.status,
          notes: notes !== undefined ? notes : profile.notes,
        },
      });
    }

    // Sync characters if provided
    let updatedProfile = profile;
    if (Array.isArray(characters)) {
      updatedProfile = await ProfileService.syncCharacters(guildId, cleanUserId, characters);
    }

    // Record audit log
    await AuditLogger.recordEntry({
      guildId,
      category: 'PROFILES',
      action: 'PROFILE_MANUAL_UPSERT',
      title: 'Вручную обновлен профиль участника',
      description: `Администратор <@${req.user!.userId}> внес данные профиля для <@${cleanUserId}> (${cleanUserTag})`,
      executorId: req.user!.userId,
      executorTag: req.user!.username,
      targetId: cleanUserId,
      targetTag: cleanUserTag,
    });

    res.json({ success: true, profile: updatedProfile });
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
    const { staticId, characterName, isMain } = req.body;
    if (!staticId) return res.status(400).json({ error: 'Укажите Static ID' });

    const updated = await ProfileService.setStatic(
      guildId,
      targetUserId,
      staticId,
      characterName,
      undefined,
      isMain !== false
    );

    res.json({ profile: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/profiles/:userId/characters
 * Set/update up to 3 characters for user
 */
router.post('/:userId/characters', requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const targetUserId = String(req.params.userId);
    const { characters } = req.body;

    if (!Array.isArray(characters)) {
      return res.status(400).json({ error: 'characters must be an array' });
    }

    const updated = await ProfileService.syncCharacters(guildId, targetUserId, characters);
    res.json({ profile: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/profiles/:userId/set-main
 * Set primary character
 */
router.post('/:userId/set-main', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const targetUserId = String(req.params.userId);
    const { staticOrCharId } = req.body;

    if (!staticOrCharId) return res.status(400).json({ error: 'Укажите staticId или characterId' });

    const updated = await ProfileService.setMainCharacter(guildId, targetUserId, staticOrCharId);
    res.json({ profile: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/profiles/:userId/penalty
 * Add penalty MPs
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

    await AuditLogger.recordEntry({
      guildId,
      category: 'PROFILES',
      action: 'PENALTY_ADD',
      title: 'Выписаны штрафные МП',
      description: `Рекрутер <@${req.user!.userId}> начислил +${penaltyCount} штрафных МП для <@${req.params.userId}>. Причина: ${reason || 'Без причины'}`,
      executorId: req.user!.userId,
      executorTag: req.user!.username,
      targetId: String(req.params.userId),
    });

    res.json({ profile: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/profiles/:userId/penalty/remove
 * Remove penalty MPs
 */
router.post('/:userId/penalty/remove', requirePermission('manageRecruiting'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const { count, reason } = req.body;
    const penaltyCount = parseInt(count, 10) || 1;

    const updated = await ProfileService.removePenaltyMp(
      guildId,
      String(req.params.userId),
      penaltyCount,
      reason
    );

    await AuditLogger.recordEntry({
      guildId,
      category: 'PROFILES',
      action: 'PENALTY_REMOVE',
      title: 'Сняты штрафные МП',
      description: `Рекрутер <@${req.user!.userId}> снял ${penaltyCount} штрафных МП для <@${req.params.userId}>. Причина: ${reason || 'Отработка'}`,
      executorId: req.user!.userId,
      executorTag: req.user!.username,
      targetId: String(req.params.userId),
    });

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

    const result = await ServerSetupService.deployPanel(guildId, 'static', channelId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
