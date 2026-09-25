import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import bot from '../client';
import prisma from '../../database/client';
import { Command } from '../client';
import { EventService } from '../modules/events/eventService';
import { AuditLogger } from '../modules/logging/auditLogger';
import { THEME, createThemedEmbed } from '../utils/theme';

export const eventCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Создание сборов на мероприятия (Капты, ВЗЗ, МЦЛ)')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Объявить сбор на мероприятие по спискам')
        .addStringOption(opt =>
          opt
            .setName('title')
            .setDescription('Тип мероприятия (Капты, ВЗЗ, МЦЛ)')
            .setRequired(true)
            .addChoices(
              { name: 'Капты', value: 'Капты' },
              { name: 'ВЗЗ', value: 'ВЗЗ' },
              { name: 'МЦЛ', value: 'МЦЛ' }
            )
        )
        .addStringOption(opt =>
          opt
            .setName('start_time')
            .setDescription('Время начала МП (в формате ЧЧ:ММ, например 20:00 или через сколько минут: 30)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('map')
            .setDescription('Карта проведения (например: Мегамолл, Порт; по умолчанию: Не выбрана)')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('limit')
            .setDescription('Лимит основного списка (по умолчанию: 35)')
            .setMinValue(5)
            .setMaxValue(100)
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('checkin_time')
            .setDescription('Время проверки явки (например 19:50 или через сколько минут: 20)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('date')
            .setDescription('День проведения сбора (по умолчанию: сегодня)')
            .addChoices(
              { name: 'Сегодня', value: 'today' },
              { name: 'Завтра', value: 'tomorrow' },
              { name: 'Послезавтра (+2 дня)', value: 'after_tomorrow' }
            )
            .setRequired(false)
        )
        .addChannelOption(opt =>
          opt
            .setName('voice_channel')
            .setDescription('Голосовой канал для сбора')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('Роль сервера для упоминания (например @Капт-состав)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('mention')
            .setDescription('Или выберите общее упоминание (@everyone, @here, без пинга)')
            .addChoices(
              { name: 'Запомненная роль по умолчанию', value: 'default' },
              { name: '@everyone (упомянуть всех)', value: 'everyone' },
              { name: '@here (только онлайн)', value: 'here' },
              { name: 'Без упоминания (тихий сбор)', value: 'none' }
            )
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('party_code')
            .setDescription('Код группы для сбора в игре')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('description')
            .setDescription('Дополнительное примечание / экипировка / правила')
            .setRequired(false)
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild || (interaction.guildId ? (bot.guilds.cache.get(interaction.guildId) || await bot.guilds.fetch(interaction.guildId).catch(() => null)) : null);
    if (!guild) {
      await interaction.reply({ content: '❌ Сервер Discord не найден.', ephemeral: true });
      return;
    }

    if (sub === 'create') {
      await interaction.deferReply({ ephemeral: true });

      const title = interaction.options.getString('title', true);
      const map = interaction.options.getString('map') || 'Не выбрана';
      const limit = interaction.options.getInteger('limit') || 35;
      const type = 'LIMITED';
      const startTimeStr = interaction.options.getString('start_time', true);
      const checkinTimeStr = interaction.options.getString('checkin_time');
      const dateChoice = interaction.options.getString('date') || 'today';
      const partyCode = interaction.options.getString('party_code');
      const voiceChannel = interaction.options.getChannel('voice_channel');
      const targetRole = interaction.options.getRole('role');
      const mentionChoice = interaction.options.getString('mention') || 'default';
      const description = interaction.options.getString('description');

      // Fetch saved channel defaults from GuildConfig
      const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } }).catch(() => null);
      const finalVoiceChannelId = voiceChannel ? voiceChannel.id : (guildConfig?.defaultVoiceChannelId || undefined);

      let finalTargetRoleId: string | undefined;
      if (targetRole) {
        finalTargetRoleId = targetRole.id;
      } else if (mentionChoice !== 'default') {
        finalTargetRoleId = mentionChoice; // 'everyone' | 'here' | 'none'
      } else {
        finalTargetRoleId = guildConfig?.defaultMentionRoleId || undefined;
      }

      // Save chosen defaults for subsequent events
      await prisma.guildConfig.upsert({
        where: { guildId: guild.id },
        update: {
          defaultEventChannelId: interaction.channelId,
          ...(voiceChannel ? { defaultVoiceChannelId: voiceChannel.id } : {}),
          ...(finalTargetRoleId ? { defaultMentionRoleId: finalTargetRoleId } : {}),
        },
        create: {
          guildId: guild.id,
          defaultEventChannelId: interaction.channelId,
          defaultVoiceChannelId: voiceChannel?.id,
          defaultMentionRoleId: finalTargetRoleId,
        },
      }).catch(() => null);

      let daysOffset = 0;
      if (dateChoice === 'tomorrow') daysOffset = 1;
      else if (dateChoice === 'after_tomorrow') daysOffset = 2;

      // Helper to parse time string
      const parseTime = (input: string): Date => {
        const now = new Date();
        const baseDate = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);

        // If user typed a number (e.g. 20 -> in 20 minutes from now)
        if (/^\d+$/.test(input.trim())) {
          const minutes = parseInt(input.trim(), 10);
          return new Date(baseDate.getTime() + minutes * 60000);
        }

        // If user typed HH:MM
        const timeMatch = input.trim().match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const target = new Date(baseDate);
          target.setHours(hours, minutes, 0, 0);

          // If date was 'today' and target is already in past today, assume tomorrow
          if (daysOffset === 0 && target.getTime() < now.getTime() - 60000) {
            target.setDate(target.getDate() + 1);
          }
          return target;
        }

        // Fallback default: in 30 mins
        return new Date(baseDate.getTime() + 30 * 60000);
      };

      const eventTime = parseTime(startTimeStr);
      const checkInTime = checkinTimeStr ? parseTime(checkinTimeStr) : new Date(eventTime.getTime() - 10 * 60000);

      // Create event in database
      const event = await prisma.eventGathering.create({
        data: {
          guildId: guild.id,
          title,
          description,
          type: 'LIMITED',
          mapName: map,
          checkInTime,
          eventTime,
          partyCode,
          voiceChannelId: finalVoiceChannelId,
          targetRoleId: finalTargetRoleId,
          participantLimit: limit,
          status: 'ACTIVE',
          channelId: interaction.channelId,
          createdById: interaction.user.id,
          createdByTag: interaction.user.tag,
          pingIntervalsJson: JSON.stringify([15, 10, 5, 3, 1]),
        },
      });

      // Send announcement message in the current text channel
      const embed = await EventService.buildEventEmbed(event.id);
      const components = EventService.buildEventButtons(event.id, true);

      let pingContent: string | undefined = undefined;
      if (finalTargetRoleId === 'everyone') {
        pingContent = '@everyone';
      } else if (finalTargetRoleId === 'here') {
        pingContent = '@here';
      } else if (finalTargetRoleId === 'none') {
        pingContent = undefined;
      } else if (finalTargetRoleId) {
        pingContent = `<@&${finalTargetRoleId}>`;
      }

      const channel = interaction.channel;
      if (!channel || !channel.isTextBased() || !('send' in channel)) {
        await interaction.editReply({ content: '❌ Неверный канал для создания сбора.' });
        return;
      }

      const announcementMsg = await (channel as any).send({
        content: pingContent,
        embeds: [embed],
        components,
      });

      // Save message ID
      await prisma.eventGathering.update({
        where: { id: event.id },
        data: { messageId: announcementMsg.id },
      });

      let mentionDisplay = 'Без упоминания';
      if (finalTargetRoleId === 'everyone') mentionDisplay = '@everyone';
      else if (finalTargetRoleId === 'here') mentionDisplay = '@here';
      else if (finalTargetRoleId && finalTargetRoleId !== 'none') mentionDisplay = `<@&${finalTargetRoleId}>`;

      // Send audit log to #ивенты-лог
      const createEmbed = createThemedEmbed({
        title: `ОБЪЯВЛЕН СБОР • ${event.title.toUpperCase()}`,
        color: THEME.COLORS.PRIMARY,
        description: [
          THEME.format.quote('Организован новый сбор на мероприятие.'),
          '',
          THEME.format.item('Организатор', `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`),
          THEME.format.item('Канал сбора', `<#${interaction.channelId}>`),
          THEME.format.item('Упоминание', mentionDisplay),
          THEME.format.item('Формат', `По спискам (${limit || 35} мест)`),
          THEME.format.item('Чек-ин', `<t:${Math.floor(checkInTime.getTime() / 1000)}:f>`),
          THEME.format.item('Старт', `<t:${Math.floor(eventTime.getTime() / 1000)}:f>`),
        ].join('\n'),
        footerText: 'INTERPOL • Журнал сборов',
      });
      await AuditLogger.sendLog(guild, 'EVENTS', createEmbed);

      await interaction.editReply({
        content: `Сбор на мероприятие **«${title}»** успешно объявлен.`,
      });
    }
  },
};

export default eventCommand;
