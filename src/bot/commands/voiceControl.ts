import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  ChannelType 
} from 'discord.js';
import bot from '../client';
import { VoiceTrackerService } from '../modules/voiceTracker/voiceTrackerService';

export const voiceControlCommand = {
  data: new SlashCommandBuilder()
    .setName('voice-control')
    .setDescription('Управление динамическим войсом МП и пультом явки')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((sub) =>
      sub
        .setName('deploy')
        .setDescription('Развернуть интерактивный пульт управления МП в текущем или выбранном канале')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Текстовый канал для пульта (доступный хайкам и депкам)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: '❌ Выберите текстовый канал.', ephemeral: true });
      return;
    }

    const guild = interaction.guild || (interaction.guildId ? (bot.guilds.cache.get(interaction.guildId) || await bot.guilds.fetch(interaction.guildId).catch(() => null)) : null);
    if (!guild) {
      await interaction.reply({ content: '❌ Сервер Discord не найден.', ephemeral: true });
      return;
    }

    try {
      await VoiceTrackerService.postControlPanel(guild, targetChannel.id);
      await interaction.reply({
        content: `✅ Пульт управления МП успешно развернут в канале <#${targetChannel.id}>!`,
        ephemeral: true,
      });
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Ошибка развертывания пульта: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};
