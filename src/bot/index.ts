import bot from './client';
import config from '../config';
import { registerCommands, deploySlashCommands } from './commands';
import { registerInteractionHandler } from './interactions/interactionHandler';
import { initializeLoggingModule } from './modules/logging';
import { EventScheduler } from './modules/events/eventScheduler';
import prisma from '../database/client';

export async function startBot() {
  if (!config.discord.token) {
    console.warn('⚠️ [Bot] DISCORD_TOKEN is not set in .env. Bot gateway will not start until configured.');
    return;
  }

  // Register command definitions and interaction handlers
  registerCommands();
  registerInteractionHandler();
  initializeLoggingModule();

  bot.once('ready', async () => {
    console.log(`🤖 [Bot Ready] Logged in as ${bot.user?.tag} (${bot.user?.id})!`);
    
    // Start background event scheduler
    EventScheduler.start();

    // Deploy slash commands
    await deploySlashCommands();

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

export default bot;
