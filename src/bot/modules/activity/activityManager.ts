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

export function mapActivityType(type: string | number): ActivityType {
  const str = String(type || '').toUpperCase();
  switch (str) {
    case '1':
    case 'STREAMING':
      return ActivityType.Streaming; // 1
    case '2':
    case 'LISTENING':
      return ActivityType.Listening; // 2
    case '3':
    case 'WATCHING':
      return ActivityType.Watching; // 3
    case '4':
    case 'CUSTOM':
      return ActivityType.Custom; // 4
    case '5':
    case 'COMPETING':
      return ActivityType.Competing; // 5
    case '0':
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
    case 'offline':
      return 'invisible';
    case 'online':
    default:
      return 'online';
  }
}

export class BotActivityManager {
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

    for (const guild of bot.guilds.cache.values()) {
      totalMembers += guild.memberCount || 0;

      // Count members in voice channels directly from guild voiceStates cache (100% accurate)
      try {
        voiceCount += guild.voiceStates.cache.filter((vs) => Boolean(vs.channelId)).size;
      } catch {
        for (const ch of guild.channels.cache.values()) {
          if (ch.isVoiceBased()) {
            voiceCount += ch.members?.size || 0;
          }
        }
      }
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
      users: totalMembers,
      guilds: bot.guilds.cache.size,
      servers: bot.guilds.cache.size,
      guildCount: bot.guilds.cache.size,
      voiceCount,
      voice: voiceCount,
      inVoice: voiceCount,
      online: totalMembers,
      activeEvents,
      events: activeEvents,
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
   * Build clean, standards-compliant Discord activity payload.
   * Keeps name as the activity/game title and state as the description/details.
   * Never glues them together into an ugly bullet-concatenated string.
   */
  public buildActivitiesPayload(
    typeStr: string | number,
    rawName: string,
    rawState: string | undefined | null,
    streamingUrl: string | undefined | null,
    vars: Record<string, string | number>
  ) {
    const parsedName = this.replacePlaceholders(rawName || '', vars).trim();
    const parsedState = rawState ? this.replacePlaceholders(rawState, vars).trim() : '';
    const type = mapActivityType(typeStr);

    const activities: any[] = [];

    if (type === ActivityType.Custom) {
      // Custom status in Discord
      const statusText = parsedName || parsedState || 'INTERPOL • Majestic RP';
      activities.push({
        name: 'Custom Status',
        type: ActivityType.Custom,
        state: statusText,
      });
    } else {
      // Pure Game / Streaming / Watching / Listening / Competing activity
      const activityObj: any = {
        name: parsedName || parsedState || 'Majestic RP • Dallas',
        type,
      };

      if (parsedState && parsedState !== parsedName) {
        activityObj.state = parsedState;
      }

      if (type === ActivityType.Streaming) {
        activityObj.url =
          streamingUrl && streamingUrl.trim().length > 0
            ? streamingUrl.trim()
            : 'https://twitch.tv/interpol';
      }

      activities.push(activityObj);
    }

    return { activities, parsedName, parsedState, type };
  }

  /**
   * Get default fallback configuration
   */
  public getDefaultConfig() {
    const defaultActivities: ActivityItem[] = [
      {
        id: '1',
        type: 'PLAYING',
        name: 'Majestic RP • Dallas',
        state: 'Семья INTERPOL • {members} бойцов',
        streamingUrl: '',
        enabled: true,
      },
      {
        id: '2',
        type: 'STREAMING',
        name: 'Капты & Дропы на Dallas',
        state: 'Семья INTERPOL',
        streamingUrl: 'https://twitch.tv/interpol',
        enabled: true,
      },
      {
        id: '3',
        type: 'WATCHING',
        name: 'за порядком в штате Dallas',
        state: 'В голосовых: {voiceCount} чел.',
        streamingUrl: '',
        enabled: true,
      },
      {
        id: '4',
        type: 'COMPETING',
        name: 'Битва за территории',
        state: 'Активных сборов: {activeEvents}',
        streamingUrl: '',
        enabled: true,
      },
    ];

    return {
      id: 'default',
      enabled: true,
      status: 'online',
      mode: 'STATIC',
      rotationInterval: 30,
      activityType: 'PLAYING',
      activityName: 'Majestic RP • Dallas',
      activityState: 'Семья INTERPOL • {members} бойцов',
      streamingUrl: 'https://twitch.tv/interpol',
      activitiesJson: JSON.stringify(defaultActivities),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Retrieve or create default configuration with safe DB self-healing
   */
  public async getConfig() {
    try {
      let config = await prisma.botActivityConfig.findUnique({
        where: { id: 'default' },
      });

      if (!config) {
        const def = this.getDefaultConfig();
        config = await prisma.botActivityConfig.create({
          data: {
            id: 'default',
            enabled: def.enabled,
            status: def.status,
            mode: def.mode,
            rotationInterval: def.rotationInterval,
            activityType: def.activityType,
            activityName: def.activityName,
            activityState: def.activityState,
            streamingUrl: def.streamingUrl,
            activitiesJson: def.activitiesJson,
          },
        });
        console.log('🎮 [BotActivityManager] Seeded default bot activity config into database.');
      }

      return config;
    } catch (err: any) {
      console.warn('⚠️ [BotActivityManager] DB access error, using fallback defaults:', err?.message);
      return this.getDefaultConfig();
    }
  }

  /**
   * Apply activity to Discord Bot client
   */
  public async applyActivity(): Promise<void> {
    if (!bot.isReady() || !bot.user) {
      return;
    }

    // Always clear existing rotation / refresh timer first
    this.stop();

    const config = await this.getConfig();

    // If activity is disabled: clear activities and preserve status
    if (!config.enabled) {
      bot.user.setPresence({
        status: mapPresenceStatus(config.status),
        activities: [],
      });
      this.currentAppliedActivity = null;
      this.lastAppliedAt = new Date();
      console.log('🎮 [Bot Activity] Presence disabled / cleared.');
      return;
    }

    const vars = await this.getLiveVariables();

    // STATIC mode: apply one status and refresh dynamic placeholders periodically
    if (config.mode !== 'ROTATING') {
      const { activities, parsedName, parsedState } = this.buildActivitiesPayload(
        config.activityType,
        config.activityName,
        config.activityState,
        config.streamingUrl,
        vars
      );

      bot.user.setPresence({
        status: mapPresenceStatus(config.status),
        activities,
      });

      this.currentAppliedActivity = {
        type: config.activityType,
        name: parsedName,
        state: parsedState,
        url: config.streamingUrl,
        status: config.status,
        mode: 'STATIC',
      };
      this.lastAppliedAt = new Date();

      console.log(`🎮 [Bot Activity] Applied static presence [${config.status}]: ${config.activityType} "${parsedName}"`);

      // Keep dynamic variables ({time}, {members}, {voiceCount}) updated every 60s
      this.rotationTimer = setInterval(async () => {
        if (!bot.isReady() || !bot.user) return;
        try {
          const freshVars = await this.getLiveVariables();
          const refreshed = this.buildActivitiesPayload(
            config.activityType,
            config.activityName,
            config.activityState,
            config.streamingUrl,
            freshVars
          );
          bot.user.setPresence({
            status: mapPresenceStatus(config.status),
            activities: refreshed.activities,
          });
          this.lastAppliedAt = new Date();
        } catch {
          // ignore timer error
        }
      }, 60000);

      return;
    }

    // ROTATING mode: cycle through enabled items
    let activities: ActivityItem[] = [];
    try {
      activities = JSON.parse(config.activitiesJson || '[]');
    } catch {
      activities = [];
    }

    const enabledActivities = activities.filter((a) => a.enabled !== false && (a.name || a.state));

    if (enabledActivities.length === 0) {
      // Fallback to static if rotation list is empty
      const { activities: payload, parsedName, parsedState } = this.buildActivitiesPayload(
        config.activityType,
        config.activityName,
        config.activityState,
        config.streamingUrl,
        vars
      );

      bot.user.setPresence({
        status: mapPresenceStatus(config.status),
        activities: payload,
      });

      this.currentAppliedActivity = {
        type: config.activityType,
        name: parsedName,
        state: parsedState,
        status: config.status,
        mode: 'STATIC_FALLBACK',
      };
      this.lastAppliedAt = new Date();
      return;
    }

    // Apply first step immediately
    this.currentRotationIndex = 0;
    await this.applySingleRotationStep(enabledActivities, config.status);

    // Set rotation timer (safe minimum 15s to respect Discord rate limits)
    const intervalSec = Math.max(15, Math.min(3600, Number(config.rotationInterval) || 30));
    this.rotationTimer = setInterval(async () => {
      this.currentRotationIndex = (this.currentRotationIndex + 1) % enabledActivities.length;
      await this.applySingleRotationStep(enabledActivities, config.status);
    }, intervalSec * 1000);
  }

  /**
   * Apply a single step in the activity rotation cycle
   */
  private async applySingleRotationStep(list: ActivityItem[], status: string) {
    if (!bot.isReady() || !bot.user || list.length === 0) return;

    try {
      const item = list[this.currentRotationIndex % list.length];
      const vars = await this.getLiveVariables();

      const { activities, parsedName, parsedState } = this.buildActivitiesPayload(
        item.type,
        item.name,
        item.state,
        item.streamingUrl,
        vars
      );

      bot.user.setPresence({
        status: mapPresenceStatus(status),
        activities,
      });

      this.currentAppliedActivity = {
        type: item.type,
        name: parsedName,
        state: parsedState,
        url: item.streamingUrl,
        status,
        index: this.currentRotationIndex,
        total: list.length,
        mode: 'ROTATING',
      };
      this.lastAppliedAt = new Date();

      console.log(`🎮 [Bot Activity] Rotation step #${this.currentRotationIndex + 1}/${list.length} [${status}]: ${item.type} "${parsedName}"`);
    } catch (err: any) {
      console.warn('⚠️ [Bot Activity] Rotation step error:', err?.message);
    }
  }

  /**
   * Stop rotation and refresh timers on shutdown or restart
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
