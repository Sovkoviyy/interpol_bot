import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits 
} from 'discord.js';
import bot, { Command } from '../client';
import { AuditLogger } from '../modules/logging/auditLogger';

export const logsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Управление системой аудита и логирования сервера')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Автоматически создать категорию LOGS и все каналы логов')
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild || (interaction.guildId ? (bot.guilds.cache.get(interaction.guildId) || await bot.guilds.fetch(interaction.guildId).catch(() => null)) : null);

    if (sub === 'setup') {
      await interaction.deferReply({ ephemeral: true });

      if (!guild) {
        await interaction.editReply({ content: '❌ Сервер Discord не найден.' });
        return;
      }

      const result = await AuditLogger.setupLogChannels(guild);

      await interaction.editReply({
        content: `✅ Категория **LOGS** и каналы аудита успешно созданы и настроены!\n` +
          `• Категория ID: \`${result.categoryId}\`\n` +
          `• Создано каналов: **${Object.keys(result.channels).length}** (сообщения, участники, роли, каналы, войс, инвайты, бот)\n` +
          `Доступ к каналам автоматически закрыт для обычных участников и открыт для администрации бота.`,
      });
    }
  },
};

export default logsCommand;
