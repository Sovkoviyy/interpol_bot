import { Router, Response } from 'express';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { getDiscordGuild, resolveGuildId } from '../utils/guild';
import { NicknameService } from '../../bot/modules/nicknames/nicknameService';

export const nicknamesRouter = Router();

nicknamesRouter.use(requireAuth);

/**
 * GET /api/nicknames/config
 * Get configuration, role bindings, and discord roles
 */
nicknamesRouter.get('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const config = await NicknameService.getConfig(guildId);

    const bindings = await prisma.roleNicknameBinding.findMany({
      where: { guildId },
      orderBy: { priority: 'desc' },
    });

    const guild = await getDiscordGuild(guildId);
    const roles = guild ? guild.roles.cache
      .filter(r => r.name !== '@everyone')
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position,
      }))
      .sort((a, b) => b.position - a.position) : [];

    return res.json({ config, bindings, roles });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/nicknames/config
 * Update general auto-nickname settings
 */
nicknamesRouter.post('/config', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const { enabled, defaultFormat, defaultPrefix, fallbackFormat } = req.body;

    const config = await prisma.nicknameConfig.upsert({
      where: { guildId },
      update: {
        enabled: typeof enabled === 'boolean' ? enabled : true,
        defaultFormat: defaultFormat || '{prefix} | {name} | {static}',
        defaultPrefix: defaultPrefix || '1',
        fallbackFormat: fallbackFormat || '{name} | {static}',
      },
      create: {
        guildId,
        enabled: typeof enabled === 'boolean' ? enabled : true,
        defaultFormat: defaultFormat || '{prefix} | {name} | {static}',
        defaultPrefix: defaultPrefix || '1',
        fallbackFormat: fallbackFormat || '{name} | {static}',
      },
    });

    return res.json({ success: true, config });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/nicknames/bindings
 * Create or update a role nickname binding
 */
nicknamesRouter.post('/bindings', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const { id, roleId, prefix, format, priority } = req.body;

    if (!roleId || !prefix) {
      return res.status(400).json({ error: 'Выберите роль и укажите префикс' });
    }

    const guild = await getDiscordGuild(guildId);
    const role = guild?.roles.cache.get(roleId);
    const roleName = role ? role.name : null;

    let binding;
    if (id) {
      binding = await prisma.roleNicknameBinding.update({
        where: { id },
        data: {
          roleId,
          roleName: roleName || undefined,
          prefix: String(prefix).trim(),
          format: format || '{prefix} | {name} | {static}',
          priority: parseInt(priority, 10) || 0,
        },
      });
    } else {
      binding = await prisma.roleNicknameBinding.upsert({
        where: {
          guildId_roleId: { guildId, roleId },
        },
        update: {
          roleName: roleName || undefined,
          prefix: String(prefix).trim(),
          format: format || '{prefix} | {name} | {static}',
          priority: parseInt(priority, 10) || 0,
        },
        create: {
          guildId,
          roleId,
          roleName,
          prefix: String(prefix).trim(),
          format: format || '{prefix} | {name} | {static}',
          priority: parseInt(priority, 10) || 0,
        },
      });
    }

    return res.json({ success: true, binding });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/nicknames/bindings/:id
 * Delete a role nickname binding
 */
nicknamesRouter.delete('/bindings/:id', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.roleNicknameBinding.delete({
      where: { id },
    });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/nicknames/sync/:userId
 * Auto-sync a single user's nickname based on their roles and main character
 */
nicknamesRouter.post('/sync/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const userId = req.params.userId as string;

    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(400).json({ error: 'Сервер Discord недоступен' });

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Участник не найден на сервере' });

    const result = await NicknameService.syncMemberNickname(member, `Синхронизация через сайт (${req.user!.username})`);

    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/nicknames/manual/:userId
 * Manually set a custom nickname for a user in Discord
 */
nicknamesRouter.post('/manual/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const userId = req.params.userId as string;
    const { nickname } = req.body;

    if (!nickname || typeof nickname !== 'string' || nickname.trim() === '') {
      return res.status(400).json({ error: 'Укажите новый никнейм' });
    }

    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(400).json({ error: 'Сервер Discord недоступен' });

    const result = await NicknameService.manualSetNickname(
      guild,
      userId,
      nickname,
      req.user!.username
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true, nickname: nickname.trim().substring(0, 32) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/nicknames/sync-all
 * Batch synchronize all guild members
 */
nicknamesRouter.post('/sync-all', requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    const guild = await getDiscordGuild(guildId);
    if (!guild) return res.status(400).json({ error: 'Сервер Discord недоступен' });

    const stats = await NicknameService.syncAllGuildMembers(guild);

    return res.json({ success: true, stats });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default nicknamesRouter;
