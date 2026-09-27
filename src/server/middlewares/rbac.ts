import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export type PermissionKey = 
  | 'manageSettings' 
  | 'manageRecruiting' 
  | 'manageEvents' 
  | 'viewLogs'
  | 'manageAcademy'
  | 'manageLeaves'
  | 'manageProfiles'
  | 'manageTier'
  | 'managePayroll'
  | string;

export function requirePermission(...permissions: PermissionKey[]) {
  return (req: AuthenticatedRequest, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userPerms = req.user.permissions as any;
    if (userPerms?.isAdmin) {
      return next();
    }

    // Admins and full settings managers have full access across modules
    if (userPerms?.manageSettings) {
      return next();
    }

    for (const permission of permissions) {
      // Coarse flag match
      if (userPerms?.[permission]) {
        return next();
      }

      // Modular permissions check
      const modular = userPerms?.modular;
      if (modular) {
        if (modular[permission]) {
          return next();
        }

        if (permission === 'manageRecruiting' && Object.keys(modular).some(k => k.startsWith('recruitment.') && modular[k])) {
          return next();
        }
        if (permission === 'manageAcademy' && Object.keys(modular).some(k => k.startsWith('academy.') && modular[k])) {
          return next();
        }
        if (permission === 'manageLeaves' && Object.keys(modular).some(k => k.startsWith('leave.') && modular[k])) {
          return next();
        }
        if (permission === 'manageEvents' && Object.keys(modular).some(k => k.startsWith('events.') && modular[k])) {
          return next();
        }
        if (permission === 'manageProfiles' && Object.keys(modular).some(k => k.startsWith('profiles.') && modular[k])) {
          return next();
        }
        if (permission === 'manageTier' && Object.keys(modular).some(k => k.startsWith('tier.') && modular[k])) {
          return next();
        }
        if (permission === 'managePayroll' && Object.keys(modular).some(k => k.startsWith('payroll.') && modular[k])) {
          return next();
        }
      }
    }

    return res.status(403).json({
      error: `Forbidden: You do not have the required permission (${permissions.join(', ')})`,
    });
  };
}
