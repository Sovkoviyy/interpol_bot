import { REST, Routes } from 'discord.js';
import bot from '../client';
import config from '../../config';
import { academyCommand } from './academy';
import { clearChannelCommand } from './clearChannel';
import { eventCommand } from './event';
import { logsCommand } from './logs';
import { profileCommand, setStaticCommand, topCommand, penaltyCommand } from './profile';
import { recruitCommand } from './recruit';
import { tierCommand } from './tier';

export function registerCommands() {
  bot.commands.clear();
  bot.commands.set('academy', academyCommand);
  bot.commands.set('clear-channel', clearChannelCommand);
  bot.commands.set('event', eventCommand);
  bot.commands.set('logs', logsCommand);
  bot.commands.set('profile', profileCommand);
  bot.commands.set('set-static', setStaticCommand);
  bot.commands.set('top', topCommand);
  bot.commands.set('penalty', penaltyCommand);
  bot.commands.set('recruit', recruitCommand);
  bot.commands.set('tier', tierCommand);
  console.log(`✅ [Commands] Registered ${bot.commands.size} slash commands.`);
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
