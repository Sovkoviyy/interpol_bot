import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from 'discord.js';
import bot from '../client';
import { TierService } from '../modules/tier/tierService';

export const tierCommand = {
  data: new SlashCommandBuilder()
    .setName('tier')
    .setDescription('Управление системой заявок на тир')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Автоматически создать категорию, канал подачи и закрытый канал для тир-чекеров')
    )
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Опубликовать панель подачи заявок на тир')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Канал для публикации панели')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild || (interaction.guildId ? (bot.guilds.cache.get(interaction.guildId) || await bot.guilds.fetch(interaction.guildId).catch(() => null)) : null);
    if (!guild) {
      await interaction.reply({ content: '❌ Сервер Discord не найден.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const res = await TierService.setupTierStructure(guild);
        await interaction.editReply({
          content: `✅ Структура системы Tier успешно развернута!\n• Категория: <#${res.categoryId}>\n• Канал подачи: <#${res.applyChannelId}>\n• Канал проверки: <#${res.reviewChannelId}>\n• Роль проверяющих: <@&${res.checkerRoleId}>`,
        });
      } catch (err: any) {
        await interaction.editReply({ content: `❌ Ошибка развертывания системы Tier: ${err.message}` });
      }
      return;
    }

    if (subcommand === 'panel') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const targetChannel = (interaction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);
        if (!targetChannel || !targetChannel.isTextBased()) {
          await interaction.editReply({ content: '❌ Укажите корректный текстовый канал.' });
          return;
        }

        await TierService.deployApplyPanel(targetChannel, guild);
        await interaction.editReply({
          content: `✅ Интерактивная панель подачи заявок на тир успешно опубликована в канале <#${targetChannel.id}>!`,
        });
      } catch (err: any) {
        await interaction.editReply({ content: `❌ Ошибка публикации панели: ${err.message}` });
      }
      return;
    }
  },
};
