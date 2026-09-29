import { Events, GuildChannel } from 'discord.js';
import bot from './client';
import config from '../config';
import { registerCommands, clearSlashCommands } from './commands';
import { handleClearChannelMessageCommand } from './commands/clearChannel';
import { registerInteractionHandler } from './interactions/interactionHandler';
import { initializeLoggingModule } from './modules/logging';
import { EventScheduler } from './modules/events/eventScheduler';
import { registerEventMessageListener } from './modules/events/eventMessageListener';
import prisma from '../database/client';

export async function startBot() {
  if (!config.discord.token) {
    console.warn('⚠️ [Bot] DISCORD_TOKEN is not set in .env. Bot gateway will not start until configured.');
    return;
  }

  // Register command definitions and interaction handlers
  registerCommands();
  registerInteractionHandler();
  registerEventMessageListener();
  initializeLoggingModule();

  // Register prefix command listener for !clear_channel
  bot.on(Events.MessageCreate, handleClearChannelMessageCommand);

  bot.once(Events.ClientReady, async () => {
    console.log(`🤖 [Bot Ready] Logged in as ${bot.user?.tag} (${bot.user?.id})!`);
    
    // Start background event scheduler
    EventScheduler.start();

    // Clear any slash commands from Discord API
    await clearSlashCommands();

    // Initialize or sync guild config for connected guilds
    for (const [guildId, guild] of bot.guilds.cache) {
      await prisma.guildConfig.upsert({
        where: { guildId },
        update: { guildName: guild.name },
        create: { guildId, guildName: guild.name },
      }).catch(err => console.error(`Failed to sync guild ${guildId}:`, err));
    }
  });

  try {
    await bot.login(config.discord.token);
  } catch (error) {
    console.error('❌ [Bot Login Error]:', error);
  }
}

/**
 * Restart the Discord bot client dynamically without taking down the web server
 */
export async function restartBot() {
  console.log('🔄 [Bot] Restart initiated from web dashboard...');

  try {
    EventScheduler.stop();
  } catch (err) {
    // ignore
  }

  try {
    bot.removeAllListeners();
    await bot.destroy();
  } catch (err) {
    console.error('Error during bot destruction:', err);
  }

  // Re-start bot client
  await startBot();
  console.log('✅ [Bot] Bot successfully reloaded from dashboard!');

  return {
    success: true,
    user: bot.user?.tag || null,
    restartedAt: new Date().toISOString(),
  };
}

/**
 * Get current bot health & status
 */
export function getBotStatus() {
  const isOnline = bot.isReady();
  return {
    online: isOnline,
    tag: bot.user?.tag || null,
    id: bot.user?.id || null,
    ping: bot.ws.ping,
    guildsCount: bot.guilds.cache.size,
    uptimeSeconds: bot.uptime ? Math.floor(bot.uptime / 1000) : 0,
  };
}

export default bot;

