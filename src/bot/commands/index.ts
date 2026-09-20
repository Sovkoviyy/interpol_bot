import { REST, Routes } from 'discord.js';
import bot from '../client';
import config from '../../config';
import { recruitCommand } from './recruit';
import { eventCommand } from './event';
import { logsCommand } from './logs';

export function registerCommands() {
  const commands = [recruitCommand, eventCommand, logsCommand];

  for (const cmd of commands) {
    bot.commands.set(cmd.data.name, cmd);
  }

  console.log(`✅ [Commands] Registered ${commands.length} local slash commands`);
}

export async function deploySlashCommands() {
  if (!config.discord.token || !config.discord.clientId) {
    console.warn('⚠️ [DeployCommands] Skipping Discord REST command deployment: token or clientId missing in .env');
    return;
  }

  const commandsJson = [
    recruitCommand.data.toJSON(),
    eventCommand.data.toJSON(),
    logsCommand.data.toJSON(),
  ];

  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    console.log('🔄 [DeployCommands] Registering slash commands with Discord API...');
    if (config.discord.guildId) {
      // Guild-specific registration (instant update, perfect for family bot!)
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: commandsJson }
      );
      console.log(`✅ [DeployCommands] Successfully registered commands for guild ${config.discord.guildId}`);
    } else {
      // Global registration
      await rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: commandsJson }
      );
      console.log('✅ [DeployCommands] Successfully registered global commands');
    }
  } catch (error) {
    console.error('❌ [DeployCommands] Failed to deploy slash commands:', error);
  }
}
