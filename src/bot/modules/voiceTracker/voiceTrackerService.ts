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
import bot from '../../client';

export interface MpTypeDefinition {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
}

export const DEFAULT_MP_TYPES: MpTypeDefinition[] = [
  { id: 'drop_16', name: 'Дроп [16:00]', description: 'Дневной сбор на дроп в 16:00', emoji: '📦' },
  { id: 'drop_20', name: 'Дроп [20:00]', description: 'Вечерний сбор на дроп в 20:00', emoji: '📦' },
  { id: 'zavod', name: 'Цех / Завод', description: 'Сбор на цех', emoji: '🏭' },
  { id: 'vzm', name: 'ВЗМ', description: 'Война за материалы', emoji: '⚔️' },
  { id: 'mcl', name: 'МЦЛ', description: 'Мажестик Чемпионс Лига', emoji: '🏆' },
  { id: 'capt', name: 'Капт', description: 'Война за территорию', emoji: '🎯' },
  { id: 'island', name: 'Остров', description: 'Битва за остров Кайо-Перико', emoji: '🏝️' },
  { id: 'train', name: 'Поезд', description: 'Перехват / охрана поезда', emoji: '🚂' },
];

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
          availableMpTypesJson: JSON.stringify(DEFAULT_MP_TYPES),
        },
      });
    }

    return config;
  }

  static async getAvailableMpTypes(guildId: string): Promise<MpTypeDefinition[]> {
    const config = await this.getConfig(guildId);
    if (!config.availableMpTypesJson) return DEFAULT_MP_TYPES;
    try {
      const parsed = JSON.parse(config.availableMpTypesJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => {
          if (typeof item === 'string') {
            return { id: `mp_${idx}`, name: item, emoji: '⚔️' };
          }
          return item;
        });
      }
    } catch {
      // fallback
    }
    return DEFAULT_MP_TYPES;
  }

  static async saveConfig(guildId: string, data: any) {
    let availableMpTypesJson: string | undefined = undefined;
    if (data.availableMpTypes !== undefined) {
      if (typeof data.availableMpTypes === 'string') {
        availableMpTypesJson = data.availableMpTypes;
      } else if (Array.isArray(data.availableMpTypes)) {
        availableMpTypesJson = JSON.stringify(data.availableMpTypes);
      }
    }

    const updated = await prisma.voiceTrackerConfig.upsert({
      where: { guildId },
      update: {
        voiceChannelId: data.voiceChannelId,
        defaultVoiceName: data.defaultVoiceName || 'Ожидание МП',
        controlChannelId: data.controlChannelId,
        logChannelId: data.logChannelId,
        ...(availableMpTypesJson !== undefined ? { availableMpTypesJson } : {}),
      },
      create: {
        guildId,
        voiceChannelId: data.voiceChannelId,
        defaultVoiceName: data.defaultVoiceName || 'Ожидание МП',
        controlChannelId: data.controlChannelId,
        logChannelId: data.logChannelId,
        availableMpTypesJson: availableMpTypesJson || JSON.stringify(DEFAULT_MP_TYPES),
      },
    });

    // Auto refresh live control panel in Discord if configured
    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (guild) {
      await this.refreshControlPanel(guild).catch(() => null);
    }

    return updated;
  }

  /**
   * Start tracking an MP session in voice
   */
  static async startSession(guild: Guild, eventName: string, startedBy: GuildMember) {
    const config = await this.getConfig(guild.id);
    if (!config.voiceChannelId) {
      throw new Error('Голосовой канал для МП не выбран в настройках!');
    }

    // Check if session is already active; auto-recover if orphaned from past bot reboot
    const existing = await prisma.voiceTrackerSession.findFirst({
      where: { guildId: guild.id, status: 'ACTIVE' },
    });
    if (existing) {
      const isOrphaned = !this.activeSessions.has(guild.id);
      const isStale = (Date.now() - existing.startedAt.getTime()) > 3 * 60 * 60 * 1000;
      if (isOrphaned || isStale) {
        console.warn(`[VoiceTracker] Auto-closing stale/orphaned session #${existing.id} (${existing.eventName})`);
        await this.endSession(guild).catch(() => null);
      } else {
        throw new Error(`Уже запущен сбор на мероприятие: «${existing.eventName}». Завершите его перед новым запуском.`);
      }
    }

    const voiceChannel = (guild.channels.cache.get(config.voiceChannelId) || 
      await guild.channels.fetch(config.voiceChannelId).catch(() => null)) as VoiceChannel | null;
    if (!voiceChannel || (voiceChannel.type !== 2 && voiceChannel.type !== 13)) {
      throw new Error('Указанный голосовой канал не найден на сервере!');
    }

    // 1. Rename voice channel dynamically
    const newVoiceName = `[МП] ${eventName}`.slice(0, 95);
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

    // 4. Update live control panel in Discord
    await this.refreshControlPanel(guild).catch(() => null);

    // 5. Send start announcement to log channel if set
    if (config.logChannelId) {
      const logChannel = (guild.channels.cache.get(config.logChannelId) || 
        await guild.channels.fetch(config.logChannelId).catch(() => null)) as TextChannel | null;
      if (logChannel && logChannel.isTextBased()) {
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

        await logChannel.send({ embeds: [startEmbed] }).catch(() => null);
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
      const voiceChannel = (guild.channels.cache.get(config.voiceChannelId) ||
        await guild.channels.fetch(config.voiceChannelId).catch(() => null)) as VoiceChannel | null;
      if (voiceChannel) {
        await voiceChannel.setName(config.defaultVoiceName || 'Ожидание МП').catch(() => null);
      }
    }

    // Finalize all attendees durations
    if (active) {
      const sessionDurationMs = now.getTime() - session.startedAt.getTime();
      for (const [userId, record] of active.attendees.entries()) {
        const leaveTime = record.leftAt || now;
        const currentPeriodSec = record.leftAt ? 0 : Math.floor((now.getTime() - record.joinedAt.getTime()) / 1000);
        const finalDuration = record.durationSeconds + currentPeriodSec;
        const isLeftEarly = Boolean(
          record.leftAt && (sessionDurationMs <= 5 * 60 * 1000 || (now.getTime() - record.leftAt.getTime()) > 5 * 60 * 1000)
        );

        attendeesList.push({
          userId,
          userTag: record.userTag,
          joinedAt: record.joinedAt.toISOString(),
          leftAt: leaveTime.toISOString(),
          durationMinutes: Math.floor(finalDuration / 60),
          durationSeconds: finalDuration,
          isLate: record.isLate,
          leftEarly: isLeftEarly,
        });

        // Credit to member profile safely
        try {
          await ProfileService.addVoiceSeconds(guild.id, userId, finalDuration);
          if (finalDuration >= 180) { // If present for at least 3 minutes, count as MP!
            await ProfileService.incrementMp(guild.id, userId, 1);
          }
        } catch (err: any) {
          console.error(`[VoiceTracker] Error crediting profile for ${userId}:`, err.message);
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

    // Refresh control panel to show idle state
    await this.refreshControlPanel(guild).catch(() => null);

    // Send summary to log channel
    if (config.logChannelId) {
      const logChannel = (guild.channels.cache.get(config.logChannelId) ||
        await guild.channels.fetch(config.logChannelId).catch(() => null)) as TextChannel | null;
      if (logChannel && logChannel.isTextBased()) {
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

        await logChannel.send({ embeds: [summaryEmbed] }).catch(() => null);
      }
    }

    return updatedSession;
  }

  /**
   * Handle member voice state changes to track join/leave events
   */
  static async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const guildId = newState.guild?.id || oldState.guild?.id;
    if (!guildId) return;
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
        existing.leftEarly = false;
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
      if (existing && !existing.leftAt) {
        const now = new Date();
        const durationThisPeriod = Math.floor((now.getTime() - existing.joinedAt.getTime()) / 1000);
        existing.durationSeconds += durationThisPeriod;
        existing.leftAt = now;
        existing.leftEarly = true;
      }
    }
  }

  /**
   * Helper to build embed and action rows for the MP control panel
   */
  static async buildControlPanelData(guild: Guild) {
    const active = this.activeSessions.get(guild.id);
    const mpTypes = await this.getAvailableMpTypes(guild.id);

    let statusText = '⚪ **Статус:** Ожидание сбора (нет активных МП)';
    let color = 0xEC4899;

    if (active) {
      const elapsedMins = Math.floor((Date.now() - active.startedAt.getTime()) / 60000);
      statusText = `🟢 **Активно сейчас:** \`${active.eventName}\`\n⏱️ **Идет уже:** \`${elapsedMins} мин.\`\n👥 **Участников:** \`${active.attendees.size} чел.\``;
      color = 0x10B981;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🎛️ Пульт управления мероприятиями (МП)')
      .setDescription(
        'Используйте меню ниже для быстрого запуска и отслеживания явки на мероприятиях семьи.\n\n' +
        `${statusText}\n\n` +
        '🟢 **При запуске:** бот переименует войс канал, включит логирование и зафиксирует опоздавших.\n' +
        '🔴 **При завершении:** бот вернет название канала, рассчитает время каждого и начислит +1 МП в профили.'
      )
      .setFooter({ text: 'Interpol Majestic RP • Управление мероприятиями' })
      .setTimestamp();

    // Map mpTypes (capped at 25 for Discord select menu limit)
    const options = mpTypes.slice(0, 25).map((mp) => ({
      label: mp.name.slice(0, 100),
      value: mp.name.slice(0, 100),
      description: (mp.description || `Мероприятие ${mp.name}`).slice(0, 100),
      emoji: mp.emoji ? mp.emoji.slice(0, 20) : undefined,
    }));

    if (options.length === 0) {
      options.push({
        label: 'Мероприятие (по умолчанию)',
        value: 'Мероприятие',
        description: 'Сбор состава',
        emoji: '⚔️',
      });
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('voice_tracker_select_mp')
      .setPlaceholder(active ? `Идет МП: ${active.eventName.slice(0, 50)} (выберите новое для переключения)` : 'Выберите тип мероприятия для запуска...')
      .addOptions(options);

    const rowSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const rowButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('voice_tracker_end_btn')
        .setLabel('🏁 Завершить текущее МП')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!active),
      new ButtonBuilder()
        .setCustomId('voice_tracker_status_btn')
        .setLabel('📊 Текущий состав в войсе')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [rowSelect, rowButtons] };
  }

  /**
   * Update the existing control panel message if it exists
   */
  static async refreshControlPanel(guild: Guild) {
    try {
      const config = await this.getConfig(guild.id);
      if (!config.controlChannelId || !config.controlMessageId) return;

      const channel = (guild.channels.cache.get(config.controlChannelId) ||
        await guild.channels.fetch(config.controlChannelId).catch(() => null)) as TextChannel | null;
      if (!channel || !channel.isTextBased()) return;

      if (!channel.messages || typeof channel.messages.fetch !== 'function') return;
      const msg = await channel.messages.fetch(config.controlMessageId).catch(() => null);
      if (!msg || typeof msg.edit !== 'function') return;

      const panelData = await this.buildControlPanelData(guild);
      await msg.edit(panelData);
    } catch (err: any) {
      console.warn('[VoiceTracker] refreshControlPanel failed:', err.message);
    }
  }

  /**
   * Deploy the Staff MP Control Panel in Discord
   */
  static async postControlPanel(guild: Guild, channelId: string) {
    const channel = (guild.channels.cache.get(channelId) ||
      await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
    if (!channel || !channel.isTextBased()) throw new Error('Канал для пульта управления не найден!');

    const panelData = await this.buildControlPanelData(guild);
    const msg = await channel.send(panelData);

    await prisma.voiceTrackerConfig.upsert({
      where: { guildId: guild.id },
      update: { controlChannelId: channelId, controlMessageId: msg.id },
      create: { guildId: guild.id, controlChannelId: channelId, controlMessageId: msg.id },
    });

    return msg;
  }
}

