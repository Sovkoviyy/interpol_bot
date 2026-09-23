import { AuthenticatedRequest } from '../middlewares/auth';
import config from '../../config';

/**
 * Resolves the active guild ID from the request.
 * Prioritizes the 'x-guild-id' header (used when switching guilds in the web panel),
 * query parameter, and body parameter,
 * falling back to the authenticated user's guildId, the configured default guildId, or 'default'.
 */
export function resolveGuildId(req: AuthenticatedRequest): string {
  const headerGuild = req.headers['x-guild-id'] as string;
  if (headerGuild && headerGuild !== 'default' && headerGuild.trim() !== '') {
    return headerGuild.trim();
  }
  const queryGuild = req.query?.guildId as string;
  if (queryGuild && queryGuild !== 'default' && queryGuild.trim() !== '') {
    return queryGuild.trim();
  }
  const bodyGuild = req.body?.guildId as string;
  if (bodyGuild && bodyGuild !== 'default' && typeof bodyGuild === 'string' && bodyGuild.trim() !== '') {
    return bodyGuild.trim();
  }
  return req.user?.guildId || config.discord.guildId || 'default';
}
