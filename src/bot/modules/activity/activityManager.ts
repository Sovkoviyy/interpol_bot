import { ActivityType, PresenceStatusData } from 'discord.js';
import bot from '../../client';
import prisma from '../../../database/client';

export interface ActivityItem {
  id: string;
  type: string; // PLAYING, STREAMING, LISTENING, WATCHING, COMPETING, CUSTOM
  name: string;
  state?: string;
  streamingUrl?: string;
  enabled?: boolean;
}

export function mapActivityType(type: string): ActivityType {
  switch (type?.toUpperCase()) {
    case 'STREAMING':
      return ActivityType.Streaming; // 1
    case 'LISTENING':
      return ActivityType.Listening; // 2
    case 'WATCHING':
      return ActivityType.Watching; // 3
    case 'COMPETING':
      return ActivityType.Competing; // 5
    case 'CUSTOM':
      return ActivityType.Custom; // 4
    case 'PLAYING':
    default:
      return ActivityType.Playing; // 0
  }
}

export function mapPresenceStatus(status: string): PresenceStatusData {
  switch (status?.toLowerCase()) {
    case 'idle':
      return 'idle';
    case 'dnd':
      return 'dnd';
    case 'invisible':
      return 'invisible';
    case 'online':
    default:
      return 'online';
  }
}

class BotActivityManager {
  private rotationTimer: NodeJS.Timeout | null = null;
  private currentRotationIndex: number = 0;
  private lastAppliedAt: Date | null = null;
  private currentAppliedActivity: any = null;

  /**
   * Calculate live dynamic variables for placeholder replacement
   */
  public async getLiveVariables(): Promise<Record<string, string | number>> {
    let totalMembers = 0;
    let voiceCount = 0;
    let onlineCount = 0;

    for (const [, guild] of bot.guilds.cache) {
      totalMembers += guild.memberCount || 0;

      // Count members currently connected to voice channels
      for (const [, ch] of guild.channels.cache) {
        if (ch.isVoiceBased()) {
          voiceCount += ch.members?.size || 0;
        }
      }

      // Count online members from cache
      onlineCount += guild.members?.cache.filter((m) => m.presence?.status && m.presence.status !== 'offline').size || 0;
    }

    // Active event gatherings in DB
    let activeEvents = 0;
    try {
      activeEvents = await prisma.eventGathering.count({
        where: { status: 'ACTIVE' },
      });
    } catch {
      // ignore
    }

    const now = new Date();
    const timeMsk = now.toLocaleTimeString('ru-RU', {
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' МСК';

    const dateMsk = now.toLocaleDateString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const ping = bot.ws.ping >= 0 ? `${bot.ws.ping}ms` : '15ms';

    return {
      members: totalMembers,
      memberCount: totalMembers,
      guilds: bot.guilds.cache.size,
      guildCount: bot.guilds.cache.size,
      voiceCount,
      inVoice: voiceCount,
      online: onlineCount || totalMembers,
      activeEvents,
      time: timeMsk,
      date: dateMsk,
      ping,
      prefix: '!',
    };
  }

  /**
   * Replace {placeholder} in template string
   */
  public replacePlaceholders(template: string, vars: Record<string, string | number>): string {
    if (!template) return '';
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      if (vars[key] !== undefined) {
        return String(vars[key]);
      }
      return match;
    });
  }

  /**
   * Retrieve or create default configuration
   */
  public async getConfig() {
    let config = await prisma.botActivityConfig.findUnique({
      where: { id: 'default' },
    });

    if (!config) {
      const defaultActivities: ActivityItem[] = [
        {
          id: '1',
          type: 'PLAYING',
          name: 'Majestic RP • Dallas',
          state: 'Семья INTERPOL • {members} уч.',
          streamingUrl: '',
          enabled: true,
        },
        {
          id: '2',
          type: 'STREAMING',
          name: 'Капты & Дропы',
          state: 'twitch.tv/interpol',
          streamingUrl: 'https://twitch.tv/interpol',
          enabled: true,
        },
        {
          id: '3',
          type: 'WATCHING',
          name: 'за порядком на сервере',
          state: 'Сборов на МП: {activeEvents}',
          streamingUrl: '',
          enabled: true,
        },
        {
          id: '4',
          type: 'LISTENING',
          name: 'Голосовые каналы',
          state: '{voiceCount} чел. в войсе',
          streamingUrl: '',
          enabled: true,
        },
      ];

      config = await prisma.botActivityConfig.create({
        data: {
          id: 'default',
          enabled: true,
          status: 'online',
          mode: 'STATIC',
          rotationInterval: 30,
          activityType: 'PLAYING',
          activityName: 'Majestic RP • INTERPOL',
          activityState: 'Сервер Dallas • {members} уч.',
          streamingUrl: 'https://twitch.tv/interpol',
          activitiesJson: JSON.stringify(defaultActivities),
        },
      });
    }

    return config;
  }

  /**
   * Apply activity to Discord Bot
   */
  public async applyActivity(): Promise<void> {
    if (!bot.isReady()) {
      return;
    }

    const config = await this.getConfig();
    const vars = await this.getLiveVariables();

    // Clear existing rotation timer
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }

    // If disabled
    if (!config.enabled) {
      bot.user.setPresence({
        status: mapPresenceStatus(config.status),
        activities: [],
      });
      this.currentAppliedActivity = null;
      this.lastAppliedAt = new Date();
      return;
    }

    // Static mode
    if (config.mode === 'STATIC') {
      const parsedName = this.replacePlaceholders(config.activityName, vars);
      const parsedState = config.activityState ? this.replacePlaceholders(config.activityState, vars) : undefined;
      const type = mapActivityType(config.activityType);
      const url = config.activityType === 'STREAMING' ? (config.streamingUrl || 'https://twitch.tv/discord') : undefined;

      bot.user.setPresence({
        status: mapPresenceStatus(config.status),
        activities: [
          {
            name: parsedName,
            type,
            url,
            state: parsedState,
          },
        ],
      });

      this.currentAppliedActivity = {
        type: config.activityType,
        name: parsedName,
        state: parsedState,
        url,
        status: config.status,
      };
      this.lastAppliedAt = new Date();
      return;
    }

    // Rotating mode
    let activities: ActivityItem[] = [];
    try {
      activities = JSON.parse(config.activitiesJson || '[]');
    } catch {
      activities = [];
    }

    const enabledActivities = activities.filter((a) => a.enabled !== false && a.name.trim().length > 0);

    if (enabledActivities.length === 0) {
      // Fallback to static values if no rotating activities configured
      const parsedName = this.replacePlaceholders(config.activityName, vars);
      const parsedState = config.activityState ? this.replacePlaceholders(config.activityState, vars) : undefined;
      bot.user.setPresence({
        status: mapPresenceStatus(config.status),
        activities: [
          {
            name: parsedName,
            type: mapActivityType(config.activityType),
            url: config.activityType === 'STREAMING' ? config.streamingUrl || 'https://twitch.tv/discord' : undefined,
            state: parsedState,
          },
        ],
      });
      this.currentAppliedActivity = {
        type: config.activityType,
        name: parsedName,
        state: parsedState,
        status: config.status,
      };
      this.lastAppliedAt = new Date();
      return;
    }

    // Apply first item immediately
    this.currentRotationIndex = 0;
    await this.applySingleRotationStep(enabledActivities, config.status);

    // Setup timer for subsequent rotation steps
    const intervalSec = Math.max(10, Math.min(3600, config.rotationInterval || 30));
    this.rotationTimer = setInterval(async () => {
      this.currentRotationIndex = (this.currentRotationIndex + 1) % enabledActivities.length;
      await this.applySingleRotationStep(enabledActivities, config.status);
    }, intervalSec * 1000);
  }

  private async applySingleRotationStep(list: ActivityItem[], status: string) {
    if (!bot.isReady() || list.length === 0) return;

    const item = list[this.currentRotationIndex % list.length];
    const vars = await this.getLiveVariables();

    const parsedName = this.replacePlaceholders(item.name, vars);
    const parsedState = item.state ? this.replacePlaceholders(item.state, vars) : undefined;
    const type = mapActivityType(item.type);
    const url = item.type === 'STREAMING' ? (item.streamingUrl || 'https://twitch.tv/discord') : undefined;

    bot.user.setPresence({
      status: mapPresenceStatus(status),
      activities: [
        {
          name: parsedName,
          type,
          url,
          state: parsedState,
        },
      ],
    });

    this.currentAppliedActivity = {
      type: item.type,
      name: parsedName,
      state: parsedState,
      url,
      status,
      index: this.currentRotationIndex,
      total: list.length,
    };
    this.lastAppliedAt = new Date();
  }

  /**
   * Stop rotation timers on shutdown or restart
   */
  public stop() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }
  }

  /**
   * Get current live status & snapshot for dashboard UI
   */
  public async getDashboardSnapshot() {
    const config = await this.getConfig();
    const vars = await this.getLiveVariables();

    let activities: ActivityItem[] = [];
    try {
      activities = JSON.parse(config.activitiesJson || '[]');
    } catch {
      activities = [];
    }

    return {
      config: {
        ...config,
        activities,
      },
      live: {
        isOnline: bot.isReady(),
        botTag: bot.user?.tag || 'INTERPOL BOT#0000',
        botAvatar: bot.user?.displayAvatarURL() || null,
        botId: bot.user?.id || null,
        currentActivity: this.currentAppliedActivity,
        lastAppliedAt: this.lastAppliedAt,
      },
      variables: vars,
    };
  }
}

export const botActivityManager = new BotActivityManager();
export default botActivityManager;
