import { Router, Response } from 'express';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireGuildId } from "../middlewares/requireGuildId";

export const rbacRouter = Router();

// Get role permissions
rbacRouter.get('/', requireAuth, requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const permissions = await prisma.rolePermission.findMany({
        where: { guildId },
    });

    const parsed = permissions.map((p) => {
        let modular: Record<string, boolean> = {};
        try {
            if (p.permissionsJson) modular = JSON.parse(p.permissionsJson);
        } catch { }
        return {
            ...p,
            modular,
        };
    });

    return res.json({ permissions: parsed });
}));

// Update or set permissions for a role
rbacRouter.post('/', requireAuth, requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const {
        roleId,
        roleName,
        manageSettings,
        manageRecruiting,
        manageEvents,
        viewLogs,
        manageAcademy,
        manageTier,
        modular,
        permissionsJson
    } = req.body;

    if (!roleId) return res.status(400).json({ error: 'Role ID is required' });

    const finalJson = permissionsJson || (modular ? JSON.stringify(modular) : null);

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
            manageTier: Boolean(manageTier),
            permissionsJson: finalJson,
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
            manageTier: Boolean(manageTier),
            permissionsJson: finalJson,
        },
    });

    return res.json({ success: true, permission: record });
}));

// Delete role permissions
rbacRouter.delete('/:roleId', requireAuth, requirePermission('manageSettings'), requireGuildId, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {

    const guildId = (req as any).guildId;
    const roleId = req.params.roleId as string;

    await prisma.rolePermission.deleteMany({
        where: { guildId, roleId },
    });

    return res.json({ success: true });
}));

export default rbacRouter;
