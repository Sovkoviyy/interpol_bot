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

export default serverSetupRouter;
