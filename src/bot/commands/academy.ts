import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  GuildMember
} from 'discord.js';
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

    const targetMember = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      await interaction.reply({ content: '❌ Участник не найден на сервере.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const { channel } = await AcademyService.createAcademyChannel(
        interaction.guild!,
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
