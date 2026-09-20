import { 
  Guild, 
  EmbedBuilder, 
  TextChannel, 
  AuditLogEvent, 
  ChannelType, 
  PermissionFlagsBits 
} from 'discord.js';
import prisma from '../../../database/client';
import { LogCategoryType } from '../../../shared/types';

export class AuditLogger {
  /**
   * Automatically sets up the 'LOGS' category and all dedicated log channels on the guild
   */
  public static async setupLogChannels(guild: Guild): Promise<{ categoryId: string; channels: Record<string, string> }> {
    // 1. Create or find Category 'LOGS'
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.toUpperCase() === 'LOGS'
    );

    if (!category) {
      category = await guild.channels.create({
        name: 'LOGS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: guild.members.me?.id || '',
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
          },
        ],
      });
    }

    const channelDefinitions: { key: string; name: string; type: LogCategoryType }[] = [
      { key: 'messageLogsChannelId', name: 'сообщения-лог', type: 'MESSAGES' },
      { key: 'memberLogsChannelId', name: 'участники-лог', type: 'MEMBERS' },
      { key: 'roleLogsChannelId', name: 'роли-лог', type: 'ROLES' },
      { key: 'channelLogsChannelId', name: 'каналы-лог', type: 'CHANNELS' },
      { key: 'voiceLogsChannelId', name: 'войс-лог', type: 'VOICE' },
      { key: 'inviteLogsChannelId', name: 'инвайты-лог', type: 'INVITES' },
      { key: 'botLogsChannelId', name: 'бот-лог', type: 'BOT' },
    ];

    const channelResults: Record<string, string> = {};

    for (const def of channelDefinitions) {
      let channel = guild.channels.cache.find(
        c => c.parentId === category!.id && c.name === def.name
      ) as TextChannel | undefined;

      if (!channel) {
        channel = await guild.channels.create({
          name: def.name,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
          ],
        });
      }

      channelResults[def.key] = channel.id;
    }

    // Save to Database
    await prisma.loggingConfig.upsert({
      where: { guildId: guild.id },
      update: {
        categoryId: category.id,
        messageLogsChannelId: channelResults.messageLogsChannelId,
        memberLogsChannelId: channelResults.memberLogsChannelId,
        roleLogsChannelId: channelResults.roleLogsChannelId,
        channelLogsChannelId: channelResults.channelLogsChannelId,
        voiceLogsChannelId: channelResults.voiceLogsChannelId,
        inviteLogsChannelId: channelResults.inviteLogsChannelId,
        botLogsChannelId: channelResults.botLogsChannelId,
      },
      create: {
        guildId: guild.id,
        categoryId: category.id,
        messageLogsChannelId: channelResults.messageLogsChannelId,
        memberLogsChannelId: channelResults.memberLogsChannelId,
        roleLogsChannelId: channelResults.roleLogsChannelId,
        channelLogsChannelId: channelResults.channelLogsChannelId,
        voiceLogsChannelId: channelResults.voiceLogsChannelId,
        inviteLogsChannelId: channelResults.inviteLogsChannelId,
        botLogsChannelId: channelResults.botLogsChannelId,
      },
    });

    return { categoryId: category.id, channels: channelResults };
  }

  /**
   * Dispatch a log embed to the configured channel
   */
  public static async sendLog(
    guild: Guild,
    categoryType: LogCategoryType,
    embed: EmbedBuilder
  ): Promise<void> {
    try {
      // Check guild config
      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId: guild.id },
      });
      if (guildConfig && !guildConfig.loggingEnabled) return;

      const logConfig = await prisma.loggingConfig.findUnique({
        where: { guildId: guild.id },
      });
      if (!logConfig) return;

      // Check if this type is enabled
      const enabledTypes: string[] = JSON.parse(logConfig.enabledLogTypesJson || '[]');
      if (!enabledTypes.includes(categoryType)) return;

      let targetChannelId: string | null = null;
      switch (categoryType) {
        case 'MESSAGES':
          targetChannelId = logConfig.messageLogsChannelId;
          break;
        case 'MEMBERS':
          targetChannelId = logConfig.memberLogsChannelId;
          break;
        case 'ROLES':
          targetChannelId = logConfig.roleLogsChannelId;
          break;
        case 'CHANNELS':
          targetChannelId = logConfig.channelLogsChannelId;
          break;
        case 'VOICE':
          targetChannelId = logConfig.voiceLogsChannelId;
          break;
        case 'INVITES':
          targetChannelId = logConfig.inviteLogsChannelId;
          break;
        case 'BOT':
          targetChannelId = logConfig.botLogsChannelId;
          break;
      }

      if (!targetChannelId) return;

      const channel = (guild.channels.cache.get(targetChannelId) || 
        await guild.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null;

      if (channel && channel.isTextBased()) {
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error(`[AuditLogger Error] Failed to send log for ${categoryType}:`, error);
    }
  }

  /**
   * Helper to fetch the executor of an audit log event
   */
  public static async getAuditLogExecutor(
    guild: Guild,
    action: AuditLogEvent,
    targetId?: string
  ) {
    try {
      const logs = await guild.fetchAuditLogs({ limit: 1, type: action });
      const entry = logs.entries.first();
      if (!entry) return null;

      // Check if entry is recent (within 10 seconds)
      const isRecent = Date.now() - entry.createdTimestamp < 10000;
      if (!isRecent) return null;

      if (targetId && entry.targetId && entry.targetId !== targetId) {
        return null;
      }

      return entry.executor;
    } catch {
      return null;
    }
  }
}
