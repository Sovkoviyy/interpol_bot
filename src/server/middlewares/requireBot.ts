import { Request, Response, NextFunction } from 'express';
import bot from '../../bot/client';

/**
 * Middleware that checks if the Discord bot client is connected.
 * Returns 503 if the bot is not available.
 */
export function requireBot(req: Request, res: Response, next: NextFunction): void {
  const client = bot;
  if (!client?.isReady()) {
    res.status(503).json({ error: 'Bot is not connected' });
    return;
  }
  (req as any).botClient = client;
  next();
}
