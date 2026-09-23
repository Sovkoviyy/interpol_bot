import { 
  Guild, 
  GuildMember, 
  VoiceState, 
  VoiceChannel, 
  TextChannel, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder 
} from 'discord.js';
import prisma from '../../../database/client';
import { ProfileService } from '../profiles/profileService';

export class VoiceTrackerService {
  /**
   * In-memory cache of current voice attendees per active session:
   * Map<sessionId, Map<userId, { joinedAt: Date, leftAt?: Date, isLate: boolean, leftEarly: boolean, durationSeconds: number }>>
   */
  private static activeSessions = new Map<string, {
    sessionId: string;
    guildId: string;
    eventName: string;
    voiceChannelId: string;
    startedAt: Date;
    attendees: Map<string, {
      userId: string;
      userTag: string;
      joinedAt: Date;
      leftAt?: Date;
      durationSeconds: number;
      isLate: boolean;
      leftEarly: boolean;
    }>;
  }>();

  static async getConfig(guildId: string) {
    let config = await prisma.voiceTrackerConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      config = await prisma.voiceTrackerConfig.create({
        data: {
          guildId,
          defaultVoiceName: 'Ожидание МП',
        },
      });
    }

    return config;
  }

  static async saveConfig(guildId: string, data: any) {
    return await prisma.voiceTrackerConfig.upsert({
      where: { guildId },
      update: {
        voiceChannelId: data.voiceChannelId,
        defaultVoiceName: data.defaultVoiceName || 'Ожидание МП',
        controlChannelId: data.controlChannelId,
        logChannelId: data.logChannelId,
      },
      create: {
        guildId,
        voiceChannelId: data.voiceChannelId,
        defaultVoiceName: data.defaultVoiceName || 'Ожидание МП',
        controlChannelId: data.controlChannelId,
        logChannelId: data.logChannelId,
      },
    });
  }

  /**
   * Start tracking an MP session in voice
   */
  static async startSession(guild: Guild, eventName: string, startedBy: GuildMember) {
    const config = await this.getConfig(guild.id);
    if (!config.voiceChannelId) {
      throw new Error('Голосовой канал для МП не выбран в настройках!');
    }

    // Check if session is already active
    const existing = await prisma.voiceTrackerSession.findFirst({
      where: { guildId: guild.id, status: 'ACTIVE' },
    });
    if (existing) {
      throw new Error(`Уже запущен сбор на мероприятие: «${existing.eventName}». Сначала завершите его.`);
    }

    const voiceChannel = guild.channels.cache.get(config.voiceChannelId) as VoiceChannel | undefined;
    if (!voiceChannel || voiceChannel.type !== 2) {
      throw new Error('Указанный голосовой канал не найден на сервере!');
    }

    // 1. Rename voice channel dynamically
    const newVoiceName = `[МП] ${eventName}`;
    await voiceChannel.setName(newVoiceName).catch((err) => {
      console.warn('[VoiceTracker] Could not rename channel (rate limit or permissions):', err.message);
    });

    // 2. Create DB record
    const session = await prisma.voiceTrackerSession.create({
      data: {
        guildId: guild.id,
        eventName,
        voiceChannelId: voiceChannel.id,
        startedById: startedBy.id,
        startedByTag: startedBy.user.tag,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    // 3. Initialize attendance map with currently connected members
    const attendeesMap = new Map();
    const now = new Date();

    for (const [memberId, member] of voiceChannel.members) {
      attendeesMap.set(memberId, {
        userId: memberId,
        userTag: member.user.tag,
        joinedAt: now,
        durationSeconds: 0,
        isLate: false,
        leftEarly: false,
      });
    }

    this.activeSessions.set(guild.id, {
      sessionId: session.id,
      guildId: guild.id,
      eventName,
      voiceChannelId: voiceChannel.id,
      startedAt: now,
      attendees: attendeesMap,
    });

    // 4. Send start announcement to log channel if set
    if (config.logChannelId) {
      const logChannel = guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
      if (logChannel) {
        const startEmbed = new EmbedBuilder()
          .setColor(0xEC4899)
          .setTitle(`⚔️ Начало мероприятия: ${eventName}`)
          .setDescription(
            `**Организатор:** ${startedBy} (\`${startedBy.user.tag}\`)\n` +
            `**Голосовой канал:** ${voiceChannel}\n` +
            `**Участников на старте:** \`${voiceChannel.members.size}\` чел.\n` +
            `Бот начал учет времени и посещаемости.`
          )
          .setTimestamp();

        await logChannel.send({ embeds: [startEmbed] });
      }
    }

    return session;
  }

  /**
   * End the active MP session and calculate statistics
   */
  static async endSession(guild: Guild, endedBy?: GuildMember) {
    const config = await this.getConfig(guild.id);
    const active = this.activeSessions.get(guild.id);

    const session = await prisma.voiceTrackerSession.findFirst({
      where: { guildId: guild.id, status: 'ACTIVE' },
    });

    if (!session) {
      throw new Error('На данный момент нет активного МП в голосовом канале.');
    }

    const now = new Date();
    const attendeesList: any[] = [];

    // Revert voice channel name
    if (config.voiceChannelId) {
      const voiceChannel = guild.channels.cache.get(config.voiceChannelId) as VoiceChannel | undefined;
      if (voiceChannel) {
        await voiceChannel.setName(config.defaultVoiceName || 'Ожидание МП').catch(() => null);
      }
    }

    // Finalize all attendees durations
    if (active) {
      for (const [userId, record] of active.attendees.entries()) {
        const leaveTime = record.leftAt || now;
        const durationSec = Math.floor((leaveTime.getTime() - record.joinedAt.getTime()) / 1000);
        const finalDuration = Math.max(record.durationSeconds, durationSec);

        attendeesList.push({
          userId,
          userTag: record.userTag,
          joinedAt: record.joinedAt.toISOString(),
          leftAt: leaveTime.toISOString(),
          durationMinutes: Math.floor(finalDuration / 60),
          durationSeconds: finalDuration,
          isLate: record.isLate,
          leftEarly: record.leftEarly,
        });

        // Credit to member profile
        await ProfileService.addVoiceSeconds(guild.id, userId, finalDuration);
        if (finalDuration >= 180) { // If present for at least 3 minutes, count as MP!
          await ProfileService.incrementMp(guild.id, userId, 1);
        }
      }
      this.activeSessions.delete(guild.id);
    }

    // Update database session
    const updatedSession = await prisma.voiceTrackerSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        endedAt: now,
        totalAttendees: attendeesList.length,
        attendanceJson: JSON.stringify(attendeesList),
      },
    });

    // Send summary to log channel
    if (config.logChannelId) {
      const logChannel = guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
      if (logChannel) {
        const totalMinutes = Math.floor((now.getTime() - session.startedAt.getTime()) / 60000);

        const summaryEmbed = new EmbedBuilder()
          .setColor(0x10B981)
          .setTitle(`🏁 Завершено мероприятие: ${session.eventName}`)
          .setDescription(
            `**Длительность:** \`${totalMinutes} мин.\`\n` +
            `**Всего побывало участников:** \`${attendeesList.length}\` чел.\n` +
            `**Завершил:** ${endedBy ? endedBy : 'Система'}\n\n` +
            `📋 **Список состава:**`
          )
          .setTimestamp();

        // Top attendees preview
        const attendeesLines = attendeesList
          .sort((a, b) => b.durationSeconds - a.durationSeconds)
          .map((a, i) => {
            const flags = [];
            if (a.isLate) flags.push('⚠️ Опоздал');
            if (a.leftEarly) flags.push('🏃 Ушел раньше');
            const flagStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';
            return `**${i + 1}.** <@${a.userId}> — \`${a.durationMinutes} мин.\`${flagStr}`;
          });

        if (attendeesLines.length > 0) {
          summaryEmbed.addFields({
            name: 'Участники и время нахождения',
            value: attendeesLines.slice(0, 25).join('\n') + (attendeesLines.length > 25 ? `\n...и еще ${attendeesLines.length - 25}` : ''),
          });
        } else {
          summaryEmbed.addFields({
            name: 'Участники',
            value: 'Никто не зашел в голосовой канал во время сбора.',
          });
        }

        await logChannel.send({ embeds: [summaryEmbed] });
      }
    }

    return updatedSession;
  }

  /**
   * Handle member voice state changes to track join/leave events
   */
  static async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const guildId = newState.guild.id;
    const active = this.activeSessions.get(guildId);
    if (!active) return;

    const targetVoiceId = active.voiceChannelId;
    const userId = newState.member?.id || oldState.member?.id;
    const userTag = newState.member?.user.tag || oldState.member?.user.tag || 'Unknown';
    if (!userId) return;

    const joinedTarget = newState.channelId === targetVoiceId && oldState.channelId !== targetVoiceId;
    const leftTarget = oldState.channelId === targetVoiceId && newState.channelId !== targetVoiceId;

    if (joinedTarget) {
      const now = new Date();
      // If joined > 5 minutes after start, mark as late
      const isLate = (now.getTime() - active.startedAt.getTime()) > 5 * 60 * 1000;

      const existing = active.attendees.get(userId);
      if (existing) {
        existing.joinedAt = now;
        existing.leftAt = undefined;
      } else {
        active.attendees.set(userId, {
          userId,
          userTag,
          joinedAt: now,
          durationSeconds: 0,
          isLate,
          leftEarly: false,
        });
      }
    } else if (leftTarget) {
      const existing = active.attendees.get(userId);
      if (existing) {
        const now = new Date();
        const durationThisPeriod = Math.floor((now.getTime() - existing.joinedAt.getTime()) / 1000);
        existing.durationSeconds += durationThisPeriod;
        existing.leftAt = now;
        existing.leftEarly = true;
      }
    }
  }

  /**
   * Deploy the Staff MP Control Panel in Discord
   */
  static async postControlPanel(guild: Guild, channelId: string) {
    const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel) throw new Error('Канал для пульта управления не найден!');

    const embed = new EmbedBuilder()
      .setColor(0xEC4899)
      .setTitle('🎛️ Пульт управления мероприятиями (МП)')
      .setDescription(
        'Используйте меню ниже для быстрого запуска и отслеживания явки на мероприятиях семьи.\n\n' +
        '🟢 **При запуске:** бот автоматически переименует голосовой канал, включит логирование явки и будет фиксировать опоздавших.\n' +
        '🔴 **При завершении:** бот вернет прежнее название канала, рассчитает время каждого участника и начислит сыгранные МП в профили.'
      )
      .setFooter({ text: 'Interpol Majestic RP • Управление составом' })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('voice_tracker_select_mp')
      .setPlaceholder('Выберите тип мероприятия для запуска...')
      .addOptions([
        { label: '📦 Дроп (16:00)', value: 'Дроп [16:00]', description: 'Сбор на дроп в 16:00' },
        { label: '📦 Дроп (20:00)', value: 'Дроп [20:00]', description: 'Вечерний дроп в 20:00' },
        { label: '🏭 Завод / Цех', value: 'Цех', description: 'Сбор на цех' },
        { label: '⚔️ ВЗМ', value: 'ВЗМ', description: 'Война за материалы' },
        { label: '🏆 МЦЛ', value: 'МЦЛ', description: 'Мажестик Чемпионс Лига' },
        { label: '🎯 Капт', value: 'Капт', description: 'Война за территорию' },
      ]);

    const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('voice_tracker_end_btn')
        .setLabel('🏁 Завершить текущее МП')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('voice_tracker_status_btn')
        .setLabel('📊 Текущий состав в войсе')
        .setStyle(ButtonStyle.Secondary)
    );

    const msg = await channel.send({ embeds: [embed], components: [rowSelect, rowButtons] });

    await prisma.voiceTrackerConfig.upsert({
      where: { guildId: guild.id },
      update: { controlChannelId: channelId, controlMessageId: msg.id },
      create: { guildId: guild.id, controlChannelId: channelId, controlMessageId: msg.id },
    });

    return msg;
  }
}
