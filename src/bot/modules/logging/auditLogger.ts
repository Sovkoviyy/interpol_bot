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
import bot from '../../client';

export class AuditLogger {
  /**
   * Automatically sets up the 'LOGS' category and all dedicated log channels on the guild
   */
  public static async setupLogChannels(guild: Guild): Promise<{ categoryId: string; channels: Record<string, string> }> {
    const existingConfig = await prisma.loggingConfig.findUnique({
      where: { guildId: guild.id },
    }).catch(() => null);

    // 1. Find Category by ID first, then fallback to name or create
    let category = existingConfig?.categoryId 
      ? guild.channels.cache.get(existingConfig.categoryId)
      : null;

    if (!category || category.type !== ChannelType.GuildCategory) {
      category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.toUpperCase() === 'LOGS'
      ) || null;
    }

    if (!category) {
      const botUserId = guild.members.me?.id || guild.client?.user?.id;
      const catOverwrites: any[] = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ];
      if (botUserId) {
        catOverwrites.push({
          id: botUserId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
        });
      }
      category = await guild.channels.create({
        name: 'LOGS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: catOverwrites,
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
      { key: 'eventLogsChannelId', name: 'ивенты-лог', type: 'EVENTS' },
    ];

    const channelResults: Record<string, string> = {};

    for (const def of channelDefinitions) {
      // Prioritize lookup by stored ID in DB (so renames don't break anything)
      const existingId = (existingConfig as any)?.[def.key];
      let channel = existingId ? (guild.channels.cache.get(existingId) as TextChannel | undefined) : undefined;

      if (!channel) {
        channel = guild.channels.cache.find(
          c => c.parentId === category!.id && c.name === def.name
        ) as TextChannel | undefined;
      }

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
        eventLogsChannelId: channelResults.eventLogsChannelId,
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
        eventLogsChannelId: channelResults.eventLogsChannelId,
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
    if (!guild || !guild.id) return;
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
      let enabledTypes: string[] = ['MESSAGES', 'MEMBERS', 'ROLES', 'CHANNELS', 'VOICE', 'INVITES', 'BOT', 'EVENTS'];
      if (logConfig.enabledLogTypesJson) {
        try {
          enabledTypes = JSON.parse(logConfig.enabledLogTypesJson);
        } catch {
          enabledTypes = ['MESSAGES', 'MEMBERS', 'ROLES', 'CHANNELS', 'VOICE', 'INVITES', 'BOT', 'EVENTS'];
        }
      }
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
        case 'EVENTS':
          targetChannelId = logConfig.eventLogsChannelId;
          break;
      }

      if (!targetChannelId) return;

      const channel = (guild.channels.cache.get(targetChannelId) || 
        await guild.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null;

      if (channel && channel.isTextBased()) {
        const botMember = guild.members.me;
        if (botMember && !channel.permissionsFor(botMember)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
          console.warn(`[AuditLogger] Missing permissions in log channel #${channel.name} (${channel.id})`);
          return;
        }
        await channel.send({ embeds: [embed] }).catch(err => {
          console.error(`[AuditLogger] Failed to send embed to #${channel.name}:`, err);
        });
      }

      // Automatically persist to DB for website audit logs without duplicate Discord dispatch
      const title = embed.data.title || `${categoryType} Log`;
      const description = embed.data.description || '';
      await prisma.auditLogEntry.create({
        data: {
          guildId: guild.id,
          category: categoryType,
          action: categoryType,
          title,
          description,
        },
      }).catch(() => null);
    } catch (error) {
      console.error(`[AuditLogger Error] Failed to send log for ${categoryType}:`, error);
    }
  }

  /**
   * Safe log routing: routes to 'BOT' channel if performed by a bot or Interpol bot itself,
   * otherwise routes to the human log category.
   */
  public static async sendHumanOrBotLog(
    guild: Guild,
    humanCategory: LogCategoryType,
    executor: { id?: string; bot?: boolean; tag?: string | null } | null | undefined,
    embed: EmbedBuilder
  ): Promise<void> {
    const botId = bot.user?.id;
    const isBot = Boolean(executor?.bot || (executor?.id && executor.id === botId));

    if (isBot) {
      await this.sendLog(guild, 'BOT', embed);
    } else {
      await this.sendLog(guild, humanCategory, embed);
    }
  }

  /**
   * Directly record a comprehensive audit log entry into the database
   * and post an embed to the dedicated bot logs channel (#бот-лог) in Discord ONLY if it's a bot action
   */
  public static async recordEntry(params: {
    guildId: string;
    category: string;
    action: string;
    title: string;
    description: string;
    executorId?: string | null;
    executorTag?: string | null;
    targetId?: string | null;
    targetTag?: string | null;
    metadata?: any;
    skipDiscord?: boolean;
  }): Promise<void> {
    try {
      if (!params.guildId) return;
      await prisma.auditLogEntry.create({
        data: {
          guildId: params.guildId,
          category: params.category,
          action: params.action,
          title: params.title,
          description: params.description,
          executorId: params.executorId || null,
          executorTag: params.executorTag || null,
          targetId: params.targetId || null,
          targetTag: params.targetTag || null,
          metadataJson: JSON.stringify(params.metadata || {}),
        },
      });

      // ONLY forward to Discord #бот-лог if this is explicitly a BOT category action and not skipped
      if (params.skipDiscord || params.category.toUpperCase() !== 'BOT') {
        return;
      }

      const { default: botClient } = await import('../../client');
      const guild = botClient.guilds.cache.get(params.guildId) || await botClient.guilds.fetch(params.guildId).catch(() => null);
      if (guild) {
        const logConfig = await prisma.loggingConfig.findUnique({
          where: { guildId: params.guildId },
        }).catch(() => null);

        let targetChannel: TextChannel | null = null;
        if (logConfig?.botLogsChannelId) {
          targetChannel = (guild.channels.cache.get(logConfig.botLogsChannelId) ||
            await guild.channels.fetch(logConfig.botLogsChannelId).catch(() => null)) as TextChannel | null;
        }

        if (!targetChannel || !targetChannel.isTextBased()) {
          targetChannel = (guild.channels.cache.find(
            c => c.type === ChannelType.GuildText && (c.name === 'бот-лог' || c.name === 'действия-бота' || c.name === 'логи-бота')
          ) || null) as TextChannel | null;
        }

        if (targetChannel && targetChannel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor(0xEC4899)
            .setTitle(`🤖 ${params.title}`)
            .setDescription(params.description || 'Действие выполнено ботом')
            .addFields(
              { name: 'Действие', value: `\`${params.action}\``, inline: true },
              { name: 'Раздел', value: params.category, inline: true }
            )
            .setTimestamp();

          if (params.executorTag || params.executorId) {
            embed.addFields({
              name: 'Исполнитель',
              value: params.executorTag ? `${params.executorTag} (${params.executorId || ''})` : `<@${params.executorId}>`,
              inline: true,
            });
          }

          if (params.targetTag || params.targetId) {
            embed.addFields({
              name: 'Цель',
              value: params.targetTag ? `${params.targetTag} (${params.targetId || ''})` : `<@${params.targetId}>`,
              inline: true,
            });
          }

          await targetChannel.send({ embeds: [embed] }).catch(() => null);
        }
      }
    } catch (err) {
      console.error('[AuditLogger] recordEntry error:', err);
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
      const logs = await guild.fetchAuditLogs({ limit: 5, type: action });
      const entry = logs.entries.find(e => {
        const isRecent = Date.now() - e.createdTimestamp < 15000;
        if (!isRecent) return false;
        if (targetId && e.targetId && e.targetId !== targetId) return false;
        return true;
      });
      return entry?.executor || null;
    } catch {
      return null;
    }
  }
}
