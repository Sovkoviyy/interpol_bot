import { REST, Routes } from 'discord.js';
import bot from '../client';
import config from '../../config';

export function registerCommands() {
  bot.commands.clear();
  console.log('ℹ️ [Commands] Slash commands are disabled. Bot operates via interactive buttons and web dashboard.');
}

/**
 * Remove / clear any previously registered slash commands from Discord REST API
 */
export async function clearSlashCommands() {
  if (!config.discord.token || !config.discord.clientId) {
    return;
  }

  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    console.log('🔄 [Commands] Clearing slash commands from Discord API...');
    if (config.discord.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: [] }
      ).catch(() => null);
      console.log(`✅ [Commands] Cleared guild slash commands for ${config.discord.guildId}`);
    }

    await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: [] }
    ).catch(() => null);
    console.log('✅ [Commands] Cleared global slash commands from Discord');
  } catch (error) {
    console.warn('ℹ️ [Commands] Note on clearing slash commands:', (error as any)?.message || error);
  }
}

export const deploySlashCommands = clearSlashCommands;
