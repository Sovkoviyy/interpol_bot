import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  PermissionFlagsBits,
  GuildMember
} from 'discord.js';
import { ProfileService } from '../modules/profiles/profileService';
import prisma from '../../database/client';

export const profileCommand = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Просмотр профиля участника семьи, статика и статистики МП')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('Пользователь для просмотра (по умолчанию ваш профиль)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const isSelf = targetUser.id === interaction.user.id;
    const member = interaction.member as GuildMember;

    // Check if requesting another person's profile
    if (!isSelf && member) {
      const isHighRank = member.permissions && typeof member.permissions.has === 'function'
        ? (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild))
        : false;

      // Check RBAC permissions
      const userRoles = member?.roles?.cache
        ? (typeof member.roles.cache.map === 'function' ? member.roles.cache.map((r: any) => r.id) : Array.from(member.roles.cache.values()).map((r: any) => r.id || r))
        : (Array.isArray(member?.roles) ? (member.roles as any) : []);
      const allowed = await prisma.rolePermission.findFirst({
        where: {
          guildId: interaction.guildId!,
          roleId: { in: userRoles },
          OR: [{ manageRecruiting: true }, { manageSettings: true }, { manageAcademy: true }],
        },
      });

      if (!isHighRank && !allowed) {
        await interaction.reply({
          content: '❌ Просмотр чужих профилей разрешен только руководству (Хайки, Рекрутеры, Депки, Лидер).',
          ephemeral: true,
        });
        return;
      }
    }

    const profile = await ProfileService.getOrCreateProfile(
      interaction.guildId!,
      targetUser.id,
      targetUser.tag
    );

    const voiceHours = (profile.voiceSeconds / 3600).toFixed(1);

    const embed = new EmbedBuilder()
      .setColor(0xEC4899)
      .setTitle(`👤 Профиль участника | ${profile.userTag || targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '🆔 Статик Majestic', value: profile.staticId ? `\`${profile.staticId}\`` : '*Не привязан*', inline: true },
        { name: '🎮 Игровой ник', value: profile.characterName ? `\`${profile.characterName}\`` : '*Не указан*', inline: true },
        { name: '🎖️ Ранг', value: profile.rank === 1 ? '1 (Академик)' : `${profile.rank} ранг`, inline: true },
        { name: '⚔️ Отыграно МП', value: `\`${profile.mpCount}\``, inline: true },
        { name: '⚖️ Штрафные МП', value: `\`${profile.penaltyMp}\``, inline: true },
        { name: '🎙️ Время в войсе МП', value: `\`${voiceHours} ч.\``, inline: true },
        {
          name: '📌 Статус',
          value: profile.status === 'ON_LEAVE'
            ? `🌴 В отпуске до ${profile.leaveUntil ? new Date(profile.leaveUntil).toLocaleDateString('ru-RU') : 'конца недели'}`
            : profile.status === 'BLACKLISTED'
            ? '⛔ В черном списке'
            : '🟢 Активен',
          inline: true,
        }
      )
      .setFooter({ text: 'Interpol Bot • Majestic RP' })
      .setTimestamp();

    if (profile.notes) {
      embed.addFields({ name: '📝 Заметки / Штрафы', value: profile.notes.slice(0, 1024), inline: false });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export const setStaticCommand = {
  data: new SlashCommandBuilder()
    .setName('set-static')
    .setDescription('Привязать свой Static ID на Majestic RP и игровой ник')
    .addStringOption((opt) =>
      opt.setName('static').setDescription('Ваш Static ID (например: 12345)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Ваш игровой ник (например: John Doe)').setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const staticId = interaction.options.getString('static', true);
    const charName = interaction.options.getString('name') || undefined;

    const updated = await ProfileService.setStatic(
      interaction.guildId!,
      interaction.user.id,
      staticId,
      charName,
      interaction.user.tag
    );

    const embed = new EmbedBuilder()
      .setColor(0x10B981)
      .setTitle('✅ Данные успешно сохранены')
      .setDescription(
        `К вашему Discord-аккаунту привязаны данные:\n` +
        `• **Static ID:** \`${updated.staticId}\`\n` +
        `• **Игровой ник:** \`${updated.characterName || 'Не указан'}\``
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const topCommand = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Рейтинг участников по посещению МП и времени в войсе')
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Категория топа')
        .setRequired(false)
        .addChoices(
          { name: 'По количеству сыгранных МП', value: 'mp' },
          { name: 'По времени в голосовых каналах МП', value: 'voice' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const category = interaction.options.getString('category') || 'mp';

    if (category === 'mp') {
      const top = await ProfileService.getTopByMp(interaction.guildId!, 10);
      const lines = top.map((p: any, i: number) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
        const staticStr = p.staticId ? ` [${p.staticId}]` : '';
        return `${medal} <@${p.userId}>${staticStr} — \`${p.mpCount} МП\``;
      });

      const embed = new EmbedBuilder()
        .setColor(0xEC4899)
        .setTitle('🏆 Топ участников по сыгранным МП')
        .setDescription(lines.length > 0 ? lines.join('\n') : 'Пока нет данных о сыгранных МП.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else {
      const top = await ProfileService.getTopByVoice(interaction.guildId!, 10);
      const lines = top.map((p: any, i: number) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
        const hours = (p.voiceMinutes / 60).toFixed(1);
        const staticStr = p.staticId ? ` [${p.staticId}]` : '';
        return `${medal} <@${p.userId}>${staticStr} — \`${hours} ч.\``;
      });

      const embed = new EmbedBuilder()
        .setColor(0xEC4899)
        .setTitle('🎙️ Топ участников по времени в войсе МП')
        .setDescription(lines.length > 0 ? lines.join('\n') : 'Пока нет данных о времени в войсе.')
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },
};

export const penaltyCommand = {
  data: new SlashCommandBuilder()
    .setName('penalty')
    .setDescription('Назначение штрафных МП участнику')
    .addUserOption((opt) => opt.setName('user').setDescription('Кому назначить штраф').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('count').setDescription('Количество штрафных МП').setRequired(true).setMinValue(1).setMaxValue(20)
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Причина штрафа').setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const isHighRank = member && member.permissions && typeof member.permissions.has === 'function'
      ? (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild))
      : false;

    const userRoles = member?.roles?.cache
      ? (typeof member.roles.cache.map === 'function' ? member.roles.cache.map((r: any) => r.id) : Array.from(member.roles.cache.values()).map((r: any) => r.id || r))
      : (Array.isArray(member?.roles) ? (member.roles as any) : []);
    const allowed = await prisma.rolePermission.findFirst({
      where: {
        guildId: interaction.guildId!,
        roleId: { in: userRoles },
        OR: [{ manageRecruiting: true }, { manageSettings: true }, { manageAcademy: true }],
      },
    });

    if (!isHighRank && !allowed) {
      await interaction.reply({ content: '❌ У вас нет прав назначать штрафы.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const count = interaction.options.getInteger('count', true);
    const reason = interaction.options.getString('reason', true);

    const updated = await ProfileService.addPenaltyMp(
      interaction.guildId!,
      targetUser.id,
      count,
      reason
    );

    const embed = new EmbedBuilder()
      .setColor(0xEF4444)
      .setTitle('⚖️ Назначен штраф по МП')
      .setDescription(
        `**Участник:** ${targetUser} (\`${targetUser.tag}\`)\n` +
        `**Назначил:** ${interaction.user} (\`${interaction.user.tag}\`)\n` +
        `**Количество штрафных МП:** \`+${count}\`\n` +
        `**Всего штрафов:** \`${updated.penaltyMp}\` МП\n` +
        `**Причина:** ${reason}`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
