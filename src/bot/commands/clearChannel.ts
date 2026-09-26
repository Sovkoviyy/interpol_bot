import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  TextChannel, 
  NewsChannel 
} from 'discord.js';
import { AuditLogger } from '../modules/logging/auditLogger';
import { THEME, createThemedEmbed } from '../utils/theme';

export const clearChannelCommand = {
  data: new SlashCommandBuilder()
    .setName('clear-channel')
    .setDescription('Очистить сообщения в текущем канале (Только для Администраторов)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addIntegerOption(opt =>
      opt
        .setName('amount')
        .setDescription('Количество последних сообщений для удаления (1-100). Оставьте пустым для полной очистки')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({ content: '❌ Команда доступна только на сервере Discord.', ephemeral: true });
      return;
    }

    // Double check administrator permission
    const hasAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    if (!hasAdmin) {
      await interaction.reply({ 
        content: '❌ У вас нет прав Администратора для выполнения этой команды!', 
        ephemeral: true 
      });
      return;
    }

    const channel = interaction.channel;
    if (!channel.isTextBased() || channel.isThread() || channel.isDMBased()) {
      await interaction.reply({ 
        content: '❌ Очистка поддерживается только в обычных текстовых каналах сервера.', 
        ephemeral: true 
      });
      return;
    }

    const textChannel = channel as TextChannel | NewsChannel;
    const amount = interaction.options.getInteger('amount');

    // Partial bulk delete
    if (amount) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const deleted = await textChannel.bulkDelete(amount, true);
        await interaction.editReply({
          content: `🧹 Успешно удалено сообщений: **${deleted.size}** (сообщения старше 14 дней не могут быть удалены через Discord API).`,
        });

        // Audit Log
        const logEmbed = createThemedEmbed({
          title: 'ОЧИСТКА СООБЩЕНИЙ В КАНАЛЕ',
          color: THEME.COLORS.WARNING,
          description: [
            THEME.format.item('Администратор', `${interaction.user} (\`${interaction.user.tag}\`)`),
            THEME.format.item('Канал', `${textChannel} (\`${textChannel.name}\`)`),
            THEME.format.item('Удалено сообщений', `${deleted.size}`),
            THEME.format.item('Время', `<t:${Math.floor(Date.now() / 1000)}:F>`),
          ].join('\n'),
          footerText: 'INTERPOL • Модерация',
        });
        await AuditLogger.sendLog(interaction.guild, 'BOT', logEmbed);
      } catch (err: any) {
        await interaction.editReply({ content: `❌ Ошибка при удалении сообщений: ${err.message}` });
      }
      return;
    }

    // Full channel purge (nuke) via clone
    try {
      await interaction.deferReply({ ephemeral: true });

      const originalPosition = textChannel.position;
      const originalTopic = textChannel.topic;
      const originalName = textChannel.name;

      // 1. Clone the channel with all exact permissions, topic, nsfw, rateLimit
      const newChannel = await textChannel.clone({
        name: originalName,
        reason: `Полная очистка канала администратором ${interaction.user.tag}`,
      });

      // 2. Set identical position
      await newChannel.setPosition(originalPosition).catch(() => null);
      if (originalTopic) {
        await newChannel.setTopic(originalTopic).catch(() => null);
      }

      // 3. Delete old channel with all messages
      await textChannel.delete(`Полная очистка канала администратором ${interaction.user.tag}`).catch(() => null);

      // 4. Send temporary clean notification in new channel
      const infoMsg = await newChannel.send({
        content: `🧹 Канал был полностью очищен администратором ${interaction.user}.`,
      }).catch(() => null);

      if (infoMsg) {
        setTimeout(async () => {
          await infoMsg.delete().catch(() => null);
        }, 7000);
      }

      // 5. Audit Log
      const logEmbed = createThemedEmbed({
        title: 'ПОЛНАЯ ОЧИСТКА КАНАЛА (NUKE)',
        color: THEME.COLORS.DANGER,
        description: [
          THEME.format.item('Администратор', `${interaction.user} (\`${interaction.user.tag}\`)`),
          THEME.format.item('Канал', `${newChannel} (\`#${originalName}\`)`),
          THEME.format.item('Статус', 'Все сообщения полностью удалены, канал пересоздан'),
          THEME.format.item('Время', `<t:${Math.floor(Date.now() / 1000)}:F>`),
        ].join('\n'),
        footerText: 'INTERPOL • Модерация',
      });
      await AuditLogger.sendLog(interaction.guild, 'BOT', logEmbed);
    } catch (err: any) {
      console.error('Failed to purge channel:', err);
      try {
        await interaction.editReply({ content: `❌ Ошибка при полной очистке канала: ${err.message}` });
      } catch {}
    }
  },
};
