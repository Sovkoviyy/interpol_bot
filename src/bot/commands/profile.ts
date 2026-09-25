import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  PermissionFlagsBits,
  GuildMember
} from 'discord.js';
import { ProfileService } from '../modules/profiles/profileService';
import { NicknameService } from '../modules/nicknames/nicknameService';
import prisma from '../../database/client';
import { THEME, createThemedEmbed } from '../utils/theme';

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

    const chars = profile.characters && profile.characters.length > 0
      ? profile.characters
      : (profile.staticId ? [{ staticId: profile.staticId, characterName: profile.characterName, isMain: true }] : []);

    const charDisplay = chars.length > 0
      ? chars.map(c => `${c.isMain ? '• **Основной:**' : '• Альт:'} \`#${c.staticId}\` ${c.characterName ? `(${c.characterName})` : ''}`).join('\n')
      : '*Не привязаны*';

    const statusDisplay = profile.status === 'ON_LEAVE'
      ? `В отпуске до ${profile.leaveUntil ? new Date(profile.leaveUntil).toLocaleDateString('ru-RU') : 'конца недели'}`
      : profile.status === 'BLACKLISTED'
      ? 'В черном списке'
      : 'Активен';

    const fields = [
      { name: 'Статики Majestic RP', value: charDisplay, inline: false },
      { name: 'Ранг', value: profile.rank === 1 ? '1 ранг (Академия)' : `${profile.rank} ранг`, inline: true },
      { name: 'Сыграно МП', value: `\`${profile.mpCount}\``, inline: true },
      { name: 'Штрафные МП', value: `\`${profile.penaltyMp}\``, inline: true },
      { name: 'Время в войсе МП', value: `\`${voiceHours} ч.\``, inline: true },
      { name: 'Статус', value: statusDisplay, inline: true },
    ];

    if (profile.notes) {
      fields.push({ name: 'Заметки / Взыскания', value: profile.notes.slice(0, 1024), inline: false });
    }

    const embed = createThemedEmbed({
      title: `ЛИЧНОЕ ДЕЛО УЧАСТНИКА • ${profile.userTag || targetUser.tag}`,
      thumbnailUrl: targetUser.displayAvatarURL(),
      fields,
      footerText: 'INTERPOL • Majestic RP',
    });

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

    if (interaction.member && (interaction.member as GuildMember).manageable) {
      await NicknameService.syncMemberNickname(interaction.member as GuildMember, 'Привязка статика и ника').catch(() => null);
    }

    const embed = createThemedEmbed({
      title: 'ПРИВЯЗКА ДАННЫХ • MAJESTIC RP',
      color: THEME.COLORS.SUCCESS,
      description: [
        THEME.format.quote('Данные участника успешно сохранены в реестре семьи.'),
        '',
        THEME.format.item('Static ID', THEME.format.code(`#${updated.staticId}`)),
        THEME.format.item('Имя персонажа', THEME.format.code(updated.characterName || 'Не указан')),
      ].join('\n'),
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export const topCommand = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Рейтинг самых активных участников семьи по сыгранным МП'),

  async execute(interaction: ChatInputCommandInteraction) {
    const top = await ProfileService.getTopByMp(interaction.guildId!, 10);
    const lines = top.map((p: any, i: number) => {
      const medal = i === 0 ? '`1.`' : i === 1 ? '`2.`' : i === 2 ? '`3.`' : `\`${i + 1}.\``;
      const staticStr = p.staticId ? ` [${p.staticId}]` : '';
      return `${medal} <@${p.userId}>${staticStr} — **${p.mpCount} МП**`;
    });

    const embed = createThemedEmbed({
      title: 'РЕЙТИНГ СОСТАВА • СЫГРАННЫЕ МП',
      color: THEME.COLORS.PRIMARY,
      description: lines.length > 0 ? lines.join('\n') : '*Пока нет данных о сыгранных мероприятиях.*',
      footerText: 'INTERPOL • Majestic RP',
    });

    await interaction.reply({ embeds: [embed] });
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

    const embed = createThemedEmbed({
      title: 'ВЗЫСКАНИЕ • НАЗНАЧЕН ШТРАФ',
      color: THEME.COLORS.DANGER,
      description: [
        THEME.format.quote('Дисциплинарное взыскание зафиксировано в реестре.'),
        '',
        THEME.format.item('Участник', `${targetUser} (\`${targetUser.tag}\`)`),
        THEME.format.item('Назначил', `${interaction.user} (\`${interaction.user.tag}\`)`),
        THEME.format.item('Штраф', THEME.format.code(`+${count} МП`)),
        THEME.format.item('Суммарно штрафов', THEME.format.code(`${updated.penaltyMp} МП`)),
        THEME.format.item('Причина', reason),
      ].join('\n'),
    });

    await interaction.reply({ embeds: [embed] });
  },
};
