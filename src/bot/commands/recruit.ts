import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits, 
  ChannelType, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from 'discord.js';
import bot, { Command } from '../client';
import prisma from '../../database/client';
import { THEME, createThemedEmbed } from '../utils/theme';
import { BotMessageManager } from '../utils/botMessageManager';

export const recruitCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('recruit')
    .setDescription('Управление системой заявок в семью')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('post')
        .setDescription('Опубликовать объявление о наборе с кнопкой «Подать заявку»')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Канал для публикации (по умолчанию текущий)')
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('config')
        .setDescription('Быстрая привязка ролей и категорий для заявок')
        .addRoleOption(opt => opt.setName('member_role').setDescription('Роль семьи для принятых'))
        .addRoleOption(opt => opt.setName('recruiter_role').setDescription('Роль рекрутера'))
        .addChannelOption(opt =>
          opt
            .setName('category')
            .setDescription('Категория для тикетов')
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addChannelOption(opt =>
          opt
            .setName('log_channel')
            .setDescription('Канал для транскриптов заявок')
            .addChannelTypes(ChannelType.GuildText)
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild || (interaction.guildId ? (bot.guilds.cache.get(interaction.guildId) || await bot.guilds.fetch(interaction.guildId).catch(() => null)) : null);
    if (!guild) {
      await interaction.reply({ content: '❌ Сервер Discord не найден.', ephemeral: true });
      return;
    }

    if (sub === 'post') {
      const channel = (interaction.options.getChannel('channel') || interaction.channel) as any;
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: '❌ Неверный текстовый канал.', ephemeral: true });
        return;
      }

      const rendered = await BotMessageManager.renderMessage(guild.id, 'recruitment_announcement', {
        guild: guild.name,
        memberCount: guild.memberCount,
      });

      const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('recruit_apply_button')
          .setLabel('Подать заявку')
          .setStyle(ButtonStyle.Primary)
      );

      const msg = await channel.send({
        content: rendered.content,
        embeds: [rendered.embed],
        components: [button],
      });

      await prisma.recruitmentConfig.upsert({
        where: { guildId: guild.id },
        update: { channelId: channel.id, messageId: msg.id },
        create: { guildId: guild.id, channelId: channel.id, messageId: msg.id },
      });

      await interaction.reply({
        content: `✅ Форма набора успешно опубликована в канале <#${channel.id}>!`,
        ephemeral: true,
      });
    } else if (sub === 'config') {
      const memberRole = interaction.options.getRole('member_role');
      const recruiterRole = interaction.options.getRole('recruiter_role');
      const category = interaction.options.getChannel('category');
      const logChannel = interaction.options.getChannel('log_channel');

      const current = await prisma.recruitmentConfig.findUnique({ where: { guildId: guild.id } });
      let recruiters: string[] = [];
      try {
        recruiters = JSON.parse(current?.recruiterRoleIds || '[]');
      } catch {
        recruiters = [];
      }

      if (recruiterRole && !recruiters.includes(recruiterRole.id)) {
        recruiters.push(recruiterRole.id);
      }

      await prisma.recruitmentConfig.upsert({
        where: { guildId: guild.id },
        update: {
          memberRoleId: memberRole ? memberRole.id : current?.memberRoleId,
          recruiterRoleIds: JSON.stringify(recruiters),
          categoryId: category ? category.id : current?.categoryId,
          logChannelId: logChannel ? logChannel.id : current?.logChannelId,
        },
        create: {
          guildId: guild.id,
          memberRoleId: memberRole?.id,
          recruiterRoleIds: JSON.stringify(recruiters),
          categoryId: category?.id,
          logChannelId: logChannel?.id,
        },
      });

      await interaction.reply({
        content: `✅ Настройки рекрутинга обновлены!\n` +
          (memberRole ? `• Роль семьи: <@&${memberRole.id}>\n` : '') +
          (recruiterRole ? `• Добавлена роль рекрутера: <@&${recruiterRole.id}>\n` : '') +
          (category ? `• Категория тикетов: <#${category.id}>\n` : '') +
          (logChannel ? `• Канал транскриптов: <#${logChannel.id}>\n` : '') +
          `\n*Все подробные настройки и вопросы формы также доступны в веб-панели.*`,
        ephemeral: true,
      });
    }
  },
};

export default recruitCommand;
