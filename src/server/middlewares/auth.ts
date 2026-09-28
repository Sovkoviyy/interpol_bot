import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../../config';
import { UserSessionData } from '../../shared/types';

export interface AuthenticatedRequest extends Request {
  user?: UserSessionData;
}

// In-memory session cache to keep JWT payload under 200 bytes and prevent Nginx 502 header overflow
export const userSessionCache = new Map<string, UserSessionData>();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, config.server.jwtSecret) as any;
    const cachedSession = userSessionCache.get(decoded.userId);

    if (cachedSession) {
      (req as AuthenticatedRequest).user = cachedSession;
    } else {
      (req as AuthenticatedRequest).user = {
        userId: decoded.userId,
        username: decoded.username || 'User',
        discriminator: decoded.discriminator || '0',
        avatar: decoded.avatar || null,
        guildId: decoded.guildId || config.discord.guildId || '',
        roles: decoded.roles || [],
        permissions: decoded.permissions || {
          isAdmin: Boolean(decoded.isAdmin),
          manageSettings: Boolean(decoded.isAdmin),
          manageRecruiting: Boolean(decoded.isAdmin),
          manageEvents: Boolean(decoded.isAdmin),
          viewLogs: Boolean(decoded.isAdmin),
          modular: {},
        },
      };
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

