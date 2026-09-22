import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import prisma from '../../database/client';
import { Command } from '../client';
import { EventService } from '../modules/events/eventService';
import { AuditLogger } from '../modules/logging/auditLogger';

export const eventCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Создание сборов на семейные мероприятия (дропы, цеха, ВЗМ и др.)')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Объявить сбор на мероприятие')
        .addStringOption(opt =>
          opt
            .setName('title')
            .setDescription('Название или тип мероприятия (например: Дроп, Цех, ВЗМ, МЦЛ)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('type')
            .setDescription('Тип сбора')
            .setRequired(true)
            .addChoices(
              { name: 'Без ограничения участников (Массовый)', value: 'UNLIMITED' },
              { name: 'С ограничением мест (Спецсостав / Капт / ВЗМ)', value: 'LIMITED' }
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
            .setName('checkin_time')
            .setDescription('Время проверки явки (например 19:50 или через сколько минут: 20)')
            .setRequired(true)
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
        )
        .addStringOption(opt =>
          opt
            .setName('party_code')
            .setDescription('Код группы для сбора в игре')
        )
        .addChannelOption(opt =>
          opt
            .setName('voice_channel')
            .setDescription('Голосовой канал (если не указать, возьмется запомненный)')
            .addChannelTypes(ChannelType.GuildVoice)
        )
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('Конкретная роль сервера для упоминания (например @Капт-состав или @Семья)')
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
        )
        .addIntegerOption(opt =>
          opt
            .setName('limit')
            .setDescription('Максимальное количество участников (для типа с ограничением)')
        )
        .addStringOption(opt =>
          opt
            .setName('description')
            .setDescription('Дополнительное примечание / экипировка / правила')
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    if (sub === 'create') {
      await interaction.deferReply({ ephemeral: true });

      const title = interaction.options.getString('title', true);
      const type = interaction.options.getString('type', true) as 'UNLIMITED' | 'LIMITED';
      const startTimeStr = interaction.options.getString('start_time', true);
      const checkinTimeStr = interaction.options.getString('checkin_time', true);
      const dateChoice = interaction.options.getString('date') || 'today';
      const partyCode = interaction.options.getString('party_code');
      const voiceChannel = interaction.options.getChannel('voice_channel');
      const targetRole = interaction.options.getRole('role');
      const mentionChoice = interaction.options.getString('mention') || 'default';
      const limit = interaction.options.getInteger('limit');
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
      const checkInTime = parseTime(checkinTimeStr);

      // Create event in database
      const event = await prisma.eventGathering.create({
        data: {
          guildId: guild.id,
          title,
          description,
          type,
          checkInTime,
          eventTime,
          partyCode,
          voiceChannelId: finalVoiceChannelId,
          targetRoleId: finalTargetRoleId,
          participantLimit: type === 'LIMITED' ? (limit || 10) : null,
          status: 'ACTIVE',
          channelId: interaction.channelId,
          createdById: interaction.user.id,
          createdByTag: interaction.user.tag,
          pingIntervalsJson: JSON.stringify([15, 10, 5, 3, 1]),
        },
      });

      // Send announcement message in the current text channel
      const embed = await EventService.buildEventEmbed(event.id);
      const components = EventService.buildEventButtons(event.id, type === 'LIMITED');

      let pingContent: string | undefined = undefined;
      if (finalTargetRoleId === 'everyone') {
        pingContent = '@everyone';
      } else if (finalTargetRoleId === 'here') {
        pingContent = '@here';
      } else if (finalTargetRoleId === 'none') {
        pingContent = undefined;
      } else if (finalTargetRoleId) {
        pingContent = `<@&${finalTargetRoleId}>`;
      } else if (type === 'UNLIMITED') {
        pingContent = '@here';
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
      else if (type === 'UNLIMITED') mentionDisplay = '@here (по умолчанию)';

      // Send audit log to #ивенты-лог
      const createEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📢 Создано новое мероприятие: ${event.title}`)
        .setDescription(
          `Создатель: <@${interaction.user.id}> (${interaction.user.tag})\n` +
          `Канал сбора: <#${interaction.channelId}>\n` +
          `Упоминание: **${mentionDisplay}**\n` +
          `Тип: **${type === 'LIMITED' ? `С ограничением (${limit || 10} мест)` : 'Без ограничений'}**\n` +
          `Чек-ин: <t:${Math.floor(checkInTime.getTime() / 1000)}:f>\n` +
          `Старт: <t:${Math.floor(eventTime.getTime() / 1000)}:f>`
        )
        .setTimestamp();
      await AuditLogger.sendLog(guild, 'EVENTS', createEmbed);

      await interaction.editReply({
        content: `✅ Сбор на мероприятие **«${title}»** успешно объявлен!`,
      });
    }
  },
};

export default eventCommand;
