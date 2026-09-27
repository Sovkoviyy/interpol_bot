import { Guild } from 'discord.js';
import bot from '../../bot/client';
import { AuthenticatedRequest } from '../middlewares/auth';
import config from '../../config';

/**
 * Resolves the active guild ID from the request.
 * Prioritizes the 'x-guild-id' header (used when switching guilds in the web panel),
 * query parameter, and body parameter,
 * falling back to the authenticated user's guildId, the configured default guildId, or 'default'.
 */
export function resolveGuildId(req: AuthenticatedRequest): string {
  // For security, always use the guild from user's JWT session
  // The x-guild-id header is only used as a hint but must be validated
  const userGuild = req.user?.guildId || config.discord.guildId || 'default';
  
  const headerGuild = req.headers['x-guild-id'] as string;
  if (headerGuild && headerGuild !== 'default' && headerGuild.trim() !== '') {
    // Only allow if it matches user's guild (multi-guild support requires explicit authorization)
    if (headerGuild.trim() === userGuild) {
      return headerGuild.trim();
    }
    // Silently fall back to user's guild for unauthorized guild access attempts
  }
  
  return userGuild;
}

/**
 * Safely resolves Discord Guild from client cache or API fetch
 */
export async function getDiscordGuild(guildId: string): Promise<Guild | null> {
  if (!guildId || guildId === 'default') return null;
  return bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
}
