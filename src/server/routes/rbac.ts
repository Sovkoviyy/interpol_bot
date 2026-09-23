import { Router, Response } from 'express';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';

export const rbacRouter = Router();

// Get role permissions
rbacRouter.get('/', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;
  const permissions = await prisma.rolePermission.findMany({
    where: { guildId },
  });

  return res.json({ permissions });
});

// Update or set permissions for a role
rbacRouter.post('/', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;
  const { 
    roleId, 
    roleName, 
    manageSettings, 
    manageRecruiting, 
    manageEvents, 
    viewLogs,
    manageAcademy,
    manageVoiceTracker,
    antiNukeAlerts
  } = req.body;

  if (!roleId) return res.status(400).json({ error: 'Role ID is required' });

  const record = await prisma.rolePermission.upsert({
    where: {
      guildId_roleId: { guildId, roleId },
    },
    update: {
      roleName,
      manageSettings: Boolean(manageSettings),
      manageRecruiting: Boolean(manageRecruiting),
      manageEvents: Boolean(manageEvents),
      viewLogs: Boolean(viewLogs),
      manageAcademy: Boolean(manageAcademy),
      manageVoiceTracker: Boolean(manageVoiceTracker),
      antiNukeAlerts: Boolean(antiNukeAlerts),
    },
    create: {
      guildId,
      roleId,
      roleName,
      manageSettings: Boolean(manageSettings),
      manageRecruiting: Boolean(manageRecruiting),
      manageEvents: Boolean(manageEvents),
      viewLogs: Boolean(viewLogs),
      manageAcademy: Boolean(manageAcademy),
      manageVoiceTracker: Boolean(manageVoiceTracker),
      antiNukeAlerts: Boolean(antiNukeAlerts),
    },
  });

  return res.json({ success: true, permission: record });
});

// Delete role permissions
rbacRouter.delete('/:roleId', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = req.user?.guildId || config.discord.guildId;
  const roleId = req.params.roleId as string;

  await prisma.rolePermission.deleteMany({
    where: { guildId, roleId },
  });

  return res.json({ success: true });
});

export default rbacRouter;
