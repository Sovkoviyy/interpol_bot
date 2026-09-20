import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
} from 'discord.js';
import prisma from '../../database/client';
import { Command } from '../client';
import { EventService } from '../modules/events/eventService';

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
            .setName('party_code')
            .setDescription('Код группы для сбора в игре')
        )
        .addChannelOption(opt =>
          opt
            .setName('voice_channel')
            .setDescription('Голосовой канал, где собираемся')
            .addChannelTypes(ChannelType.GuildVoice)
        )
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('Роль для упоминания (например @Семья или @Капт-состав)')
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
      const partyCode = interaction.options.getString('party_code');
      const voiceChannel = interaction.options.getChannel('voice_channel');
      const targetRole = interaction.options.getRole('role');
      const limit = interaction.options.getInteger('limit');
      const description = interaction.options.getString('description');

      // Helper to parse time string
      const parseTime = (input: string): Date => {
        const now = new Date();
        // If user typed a number (e.g. 20 -> in 20 minutes)
        if (/^\d+$/.test(input.trim())) {
          const minutes = parseInt(input.trim(), 10);
          return new Date(now.getTime() + minutes * 60000);
        }

        // If user typed HH:MM
        const timeMatch = input.trim().match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const target = new Date(now);
          target.setHours(hours, minutes, 0, 0);

          // If target is already in the past today, assume tomorrow
          if (target.getTime() < now.getTime() - 60000) {
            target.setDate(target.getDate() + 1);
          }
          return target;
        }

        // Fallback default: in 30 mins
        return new Date(now.getTime() + 30 * 60000);
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
          voiceChannelId: voiceChannel?.id,
          targetRoleId: targetRole?.id,
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

      const pingContent = targetRole ? `<@&${targetRole.id}>` : (type === 'UNLIMITED' ? '@here' : undefined);

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

      await interaction.editReply({
        content: `✅ Сбор на мероприятие **«${title}»** успешно объявлен!`,
      });
    }
  },
};

export default eventCommand;
