import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export type PermissionKey = 'manageSettings' | 'manageRecruiting' | 'manageEvents' | 'viewLogs';

export function requirePermission(permission: PermissionKey) {
  return (req: AuthenticatedRequest, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.permissions.isAdmin) {
      return next();
    }

    if (req.user.permissions[permission]) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: You do not have the required permission (${permission})`,
    });
  };
}
