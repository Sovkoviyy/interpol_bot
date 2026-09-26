import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { ServerSetupService } from '../../bot/modules/setup/serverSetupService';
import config from '../../config';

import { resolveGuildId } from '../utils/guild';

export const serverSetupRouter = Router();

/**
 * GET /api/setup/guilds
 * List all Discord servers the bot is in
 */
serverSetupRouter.get('/guilds', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const guilds = ServerSetupService.listGuilds();
    res.json({ guilds });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/setup/status
 * Get current setup status and channel bindings for the selected guild
 */
serverSetupRouter.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Сервер Discord не выбран' });
    }

    const state = await ServerSetupService.getGuildSetupState(guildId);
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/setup/provision
 * One-click provision full server structure and deploy initial panels
 */
serverSetupRouter.post('/provision', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Сервер Discord не выбран' });
    }

    const { deployPanels } = req.body;
    const result = await ServerSetupService.provisionServer(guildId, { deployPanels: deployPanels !== false });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/setup/deploy-panel
 * Deploy or re-deploy a specific bot message / panel into a channel
 */
serverSetupRouter.post('/deploy-panel', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Сервер Discord не выбран' });
    }

    const { panelType, channelId } = req.body;
    if (!panelType) {
      return res.status(400).json({ error: 'Укажите тип панели (static, leave, recruit, welcome, logs, voice-tracker)' });
    }

    const result = await ServerSetupService.deployPanel(guildId, panelType, channelId);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/setup/bindings
 * Update channel and category bindings for the guild
 */
serverSetupRouter.post('/bindings', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Сервер Discord не выбран' });
    }

    const { bindings } = req.body;
    if (!bindings) {
      return res.status(400).json({ error: 'Передайте объект bindings с ID каналов' });
    }

    await ServerSetupService.updateBindings(guildId, bindings);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/setup/role-bindings
 * Update role bindings for the guild
 */
serverSetupRouter.post('/role-bindings', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Сервер Discord не выбран' });
    }

    const { roleBindings } = req.body;
    if (!roleBindings) {
      return res.status(400).json({ error: 'Передайте объект roleBindings' });
    }

    await ServerSetupService.updateRoleBindings(guildId, roleBindings);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/setup/create-role
 * Create a new role in Discord server
 */
serverSetupRouter.post('/create-role', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Сервер Discord не выбран' });
    }

    const { name, color, hoist } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Укажите название роли' });
    }

    const created = await ServerSetupService.createRole(guildId, { name, color, hoist });
    res.json({ success: true, role: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/setup/create-channel
 * Create a new channel or category in Discord server
 */
serverSetupRouter.post('/create-channel', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Сервер Discord не выбран' });
    }

    const { name, type, parentId, topic } = req.body;
    if (!name || type === undefined) {
      return res.status(400).json({ error: 'Укажите название и тип канала' });
    }

    const created = await ServerSetupService.createChannel(guildId, { name, type, parentId, topic });
    res.json({ success: true, channel: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/setup/auto-detect
 * Scan existing Discord channels and roles to automatically map them
 */
serverSetupRouter.post('/auto-detect', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const guildId = resolveGuildId(req);
    if (!guildId) {
      return res.status(400).json({ error: 'Сервер Discord не выбран' });
    }

    const result = await ServerSetupService.autoDetectBindings(guildId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default serverSetupRouter;

