import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
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

    try {
      await VoiceTrackerService.postControlPanel(interaction.guild!, targetChannel.id);
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
