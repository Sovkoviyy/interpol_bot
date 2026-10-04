import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that extracts guildId from query params or body and attaches it to req.
 * Returns 400 if guildId is not provided.
 */
export function requireGuildId(req: Request, res: Response, next: NextFunction): void {
  const guildId = (req.query.guildId as string) || req.body?.guildId;
  if (!guildId) {
    res.status(400).json({ error: 'guildId is required' });
    return;
  }
  // Attach to request for downstream handlers
  (req as any).guildId = guildId;
  next();
}
