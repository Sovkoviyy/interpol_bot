import { Request, Response, NextFunction } from 'express';
import config from '../../config';
import bot from '../../bot/client';

/**
 * Middleware that extracts guildId from query params, body, headers,
 * or falls back to user session, config.discord.guildId, or the connected Discord bot guild.
 * Guarantees that single-guild requests never fail with 400 even if the frontend doesn't pass ?guildId=.
 */
export function requireGuildId(req: Request, res: Response, next: NextFunction): void {
  let guildId =
    (req.query.guildId as string) ||
    req.body?.guildId ||
    (req.headers['x-guild-id'] as string) ||
    (req as any).user?.guildId;

  // Fallback to configured default guild if missing or placeholder
  if (!guildId || guildId === 'default' || guildId.includes('your_')) {
    guildId = config.discord.guildId;
  }

  // Fallback to the first guild the bot is connected to
  if (!guildId || guildId === 'default' || guildId.includes('your_')) {
    const firstBotGuild = bot?.guilds?.cache?.first()?.id;
    if (firstBotGuild) {
      guildId = firstBotGuild;
    }
  }

  if (!guildId || guildId.includes('your_')) {
    res.status(400).json({ error: 'guildId is required and could not be determined' });
    return;
  }

  // Attach to request for downstream handlers
  (req as any).guildId = guildId;
  next();
}
