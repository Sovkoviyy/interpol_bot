import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  GuildMember,
  MessageFlags
} from 'discord.js';
import bot from '../client';
import { AcademyService } from '../modules/academy/academyService';

export const academyCommand = {
  data: new SlashCommandBuilder()
    .setName('academy')
    .setDescription('Управление академией и каналами сдачи отчетов')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Создать личный канал академии для участника 1 ранга')
        .addUserOption((opt) => opt.setName('member').setDescription('Академик').setRequired(true))
        .addStringOption((opt) => opt.setName('static').setDescription('Static ID').setRequired(false))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('member', true);
    const staticId = interaction.options.getString('static') || undefined;

    const guild = interaction.guild || (interaction.guildId ? (bot.guilds.cache.get(interaction.guildId) || await bot.guilds.fetch(interaction.guildId).catch(() => null)) : null);
    if (!guild) {
      await interaction.reply({ content: '❌ Сервер Discord не найден.', flags: MessageFlags.Ephemeral });
      return;
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      await interaction.reply({ content: '❌ Участник не найден на сервере.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const { channel } = await AcademyService.createAcademyChannel(
        guild,
        targetMember,
        staticId
      );

      await interaction.editReply({
        content: `✅ Личный канал академии успешно создан: <#${channel.id}> для ${targetMember}.`,
      });
    } catch (err: any) {
      await interaction.editReply({
        content: `❌ Ошибка создания канала академии: ${err.message}`,
      });
    }
  },
};
