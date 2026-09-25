import { 
  Guild, 
  GuildChannel, 
  GuildMember,
  DMChannel, 
  AuditLogEvent, 
  EmbedBuilder, 
  ChannelType, 
  PermissionOverwrites, 
  Role,
  TextChannel 
} from 'discord.js';
import prisma from '../../../database/client';
import { THEME, createThemedEmbed } from '../../utils/theme';

export class AntiNukeService {
  /**
   * Get Anti-Nuke configuration
   */
  static async getConfig(guildId: string) {
    let config = await prisma.antiNukeConfig.findUnique({ where: { guildId } });
    if (!config) {
      config = await prisma.antiNukeConfig.create({
        data: {
          guildId,
          enabled: true,
          actionOnChannelDelete: 'STRIP_ROLES_RESTORE',
          alertUserIdsJson: '[]',
        },
      });
    }
    return config;
  }

  static async saveConfig(guildId: string, data: any) {
    return await prisma.antiNukeConfig.upsert({
      where: { guildId },
      update: {
        enabled: data.enabled ?? true,
        actionOnChannelDelete: data.actionOnChannelDelete || 'STRIP_ROLES_RESTORE',
        alertUserIdsJson: typeof data.alertUserIds === 'string' ? data.alertUserIds : JSON.stringify(data.alertUserIds || []),
        alertChannelId: data.alertChannelId,
      },
      create: {
        guildId,
        enabled: data.enabled ?? true,
        actionOnChannelDelete: data.actionOnChannelDelete || 'STRIP_ROLES_RESTORE',
        alertUserIdsJson: typeof data.alertUserIds === 'string' ? data.alertUserIds : JSON.stringify(data.alertUserIds || []),
        alertChannelId: data.alertChannelId,
      },
    });
  }

  /**
   * Triggered on ChannelDelete event
   */
  static async handleChannelDelete(channel: GuildChannel) {
    try {
      const guild = channel.guild;
      const config = await this.getConfig(guild.id);
      if (!config.enabled) return;

      // 1. Fetch Audit Logs to find who deleted the channel
      const auditLogs = await guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelDelete,
      }).catch(() => null);

      const entry = auditLogs?.entries.first();
      if (!entry) return;

      const executor = entry.executor;
      // Do not punish the bot itself or guild owner
      if (!executor || executor.id === guild.client.user.id || executor.id === guild.ownerId) {
        return;
      }

      // Check if entry is recent (within 10 seconds)
      const isRecent = (Date.now() - entry.createdTimestamp) < 10000;
      if (!isRecent) return;

      const offender = await guild.members.fetch(executor.id).catch(() => null);

      console.warn(`[AntiNuke] Channel "${channel.name}" deleted by ${executor.tag} (${executor.id}). Taking emergency action.`);

      // 2. Action on offender: Strip all manageable roles immediately
      if (offender && offender.manageable) {
        const rolesToRemove = offender.roles.cache.filter(r => r.id !== guild.id);
        await offender.roles.remove(rolesToRemove, 'ANTI-NUKE: Несанкционированное удаление канала').catch((err) => {
          console.error('[AntiNuke] Could not strip roles from offender:', err);
        });
      }

      // 3. Rollback: Restore the deleted channel
      let restoredChannel: any = null;
      try {
        const permissionOverwrites = channel.permissionOverwrites.cache.map(po => ({
          id: po.id,
          allow: po.allow.bitfield,
          deny: po.deny.bitfield,
          type: po.type,
        }));

        restoredChannel = await guild.channels.create({
          name: channel.name,
          type: channel.type as any,
          parent: channel.parentId || undefined,
          position: channel.rawPosition,
          topic: (channel as any).topic || undefined,
          permissionOverwrites,
          reason: `ANTI-NUKE: Автоматический роллбек канала после удаления ${executor.tag}`,
        });
      } catch (err) {
        console.error('[AntiNuke] Failed to restore channel:', err);
      }

      // 4. Send emergency alert to configured High Ranks / Leader in DM
      let alertUserIds: string[] = [];
      try {
        alertUserIds = JSON.parse(config.alertUserIdsJson);
      } catch {
        // fallback
      }
      if (!alertUserIds.includes(guild.ownerId)) {
        alertUserIds.push(guild.ownerId);
      }

      const alertEmbed = createThemedEmbed({
        title: 'СРАБОТАЛА ЗАЩИТА СЕРВЕРА • ANTI-NUKE',
        color: THEME.COLORS.DANGER,
        description: [
          THEME.format.quote('Зафиксировано несанкционированное удаление канала.'),
          '',
          THEME.format.item('Удаленный канал', `\`#${channel.name}\` (\`${channel.id}\`)`),
          THEME.format.item('Инициатор', `<@${executor.id}> (\`${executor.tag}\`)`),
          '',
          THEME.format.section('Принятые меры защиты'),
          THEME.format.bullet('С нарушителя сняты все роли доступа на сервере.'),
          restoredChannel
            ? THEME.format.bullet(`Канал успешно восстановлен: ${restoredChannel}`)
            : THEME.format.bullet('Автоматическое восстановление канала не удалось.'),
        ].join('\n'),
        thumbnailUrl: executor.displayAvatarURL(),
        footerText: 'INTERPOL • Безопасность сервера',
      });

      for (const adminId of alertUserIds) {
        try {
          const user = await guild.client.users.fetch(adminId).catch(() => null);
          if (user) {
            await user.send({ embeds: [alertEmbed] }).catch(() => null);
          }
        } catch {
          // ignore DM fail
        }
      }

      // 5. Send alert to configured alertChannel
      if (config.alertChannelId) {
        const alertChannel = (guild.channels.cache.get(config.alertChannelId) ||
          await guild.channels.fetch(config.alertChannelId).catch(() => null)) as TextChannel | null;
        if (alertChannel && alertChannel.isTextBased()) {
          await (alertChannel as any).send({ embeds: [alertEmbed] }).catch(() => null);
        }
      }
    } catch (err) {
      console.error('[AntiNuke] Critical error in handler:', err);
    }
  }

  /**
   * Triggered when a bot is added to the guild (GuildMemberAdd where member.user.bot === true)
   */
  static async handleBotAdd(member: GuildMember) {
    if (!member || !member.user?.bot) return;
    try {
      const guild = member.guild;
      if (!guild || !guild.id) return;

      const config = await this.getConfig(guild.id);
      if (!config.enabled) return;

      // Fetch Audit Logs to find who added the bot
      const auditLogs = typeof guild.fetchAuditLogs === 'function'
        ? await guild.fetchAuditLogs({
            limit: 1,
            type: AuditLogEvent.BotAdd,
          }).catch(() => null)
        : null;

      const entry = auditLogs?.entries?.first ? auditLogs.entries.first() : null;
      const executor = entry?.executor;

      // Do not punish if added by server owner or the bot itself
      if (executor && (executor.id === guild.ownerId || executor.id === guild.client?.user?.id)) {
        return;
      }

      // Check if entry is recent (within 15 seconds) if available
      if (entry && entry.createdTimestamp) {
        const isRecent = (Date.now() - entry.createdTimestamp) < 15000;
        if (!isRecent) return;
      }

      console.warn(`[AntiNuke] Bot "${member.user.tag}" (${member.id}) added by unauthorized user ${executor?.tag || 'unknown'} (${executor?.id || 'unknown'}). Taking emergency action.`);

      // 1. Kick or ban the added bot
      let botKicked = false;
      if (member.kickable) {
        await member.kick('ANTI-NUKE: Несанкционированное добавление бота').catch(() => null);
        botKicked = true;
      }

      // 2. Action on offender: Strip all manageable roles
      let offenderStripped = false;
      if (executor?.id) {
        const offender = await guild.members.fetch(executor.id).catch(() => null);
        if (offender && offender.manageable) {
          const rolesToRemove = offender.roles.cache.filter(r => r.id !== guild.id);
          await offender.roles.remove(rolesToRemove, 'ANTI-NUKE: Несанкционированное добавление бота').catch(() => null);
          offenderStripped = true;
        }
      }

      // 3. Send emergency alert to high ranks and server owner
      let alertUserIds: string[] = [];
      try {
        alertUserIds = JSON.parse(config.alertUserIdsJson);
      } catch {}
      if (!alertUserIds.includes(guild.ownerId)) {
        alertUserIds.push(guild.ownerId);
      }

      const alertEmbed = createThemedEmbed({
        title: 'СРАБОТАЛА ЗАЩИТА СЕРВЕРА • ДОБАВЛЕН БОТ',
        color: THEME.COLORS.DANGER,
        description: [
          THEME.format.quote('Зафиксировано несанкционированное добавление бота.'),
          '',
          THEME.format.item('Добавленный бот', `${member} (\`${member.user.tag}\` / \`${member.id}\`)`),
          THEME.format.item('Инициатор', executor ? `<@${executor.id}> (\`${executor.tag}\`)` : 'Неизвестно'),
          '',
          THEME.format.section('Принятые меры защиты'),
          botKicked
            ? THEME.format.bullet('Добавленный бот немедленно исключен с сервера.')
            : THEME.format.bullet('Не удалось исключить бота (проверьте права).'),
          offenderStripped
            ? THEME.format.bullet(`С пользователя ${executor?.tag} сняты все роли доступа.`)
            : '',
        ].filter(Boolean).join('\n'),
        thumbnailUrl: member.user.displayAvatarURL(),
        footerText: 'INTERPOL • Безопасность сервера',
      });

      for (const adminId of alertUserIds) {
        try {
          const user = await guild.client.users.fetch(adminId).catch(() => null);
          if (user) {
            await user.send({ embeds: [alertEmbed] }).catch(() => null);
          }
        } catch {}
      }

      // 4. Send alert to configured alertChannel
      if (config.alertChannelId) {
        const alertChannel = (guild.channels.cache.get(config.alertChannelId) ||
          await guild.channels.fetch(config.alertChannelId).catch(() => null)) as TextChannel | null;
        if (alertChannel && alertChannel.isTextBased()) {
          await (alertChannel as any).send({ embeds: [alertEmbed] }).catch(() => null);
        }
      }

      // 5. Send strictly to BOT audit log
      const { AuditLogger } = await import('../logging/auditLogger');
      await AuditLogger.sendLog(guild, 'BOT', alertEmbed);
    } catch (err) {
      console.error('[AntiNuke] Error handling bot add:', err);
    }
  }

  /**
   * Create a full server snapshot backup (categories, channels, roles, permissions)
   */
  static async createSnapshot(guild: Guild, name: string, createdById?: string, createdByTag?: string) {
    const rolesList = 'values' in guild.roles.cache ? Array.from((guild.roles.cache as any).values()) : Array.from((guild.roles.cache as any) || []);
    const rolesData = (rolesList as any[])
      .filter((r: any) => r.id !== guild.id)
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        color: r.hexColor || '#000000',
        hoist: Boolean(r.hoist),
        permissions: r.permissions?.bitfield ? r.permissions.bitfield.toString() : '0',
        position: r.position || 0,
        mentionable: Boolean(r.mentionable),
      }));

    const channelsList = 'values' in guild.channels.cache ? Array.from((guild.channels.cache as any).values()) : Array.from((guild.channels.cache as any) || []);
    const channelsData = (channelsList as any[]).map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId,
      position: c.rawPosition ?? 0,
      topic: c.topic || null,
      permissionOverwrites: c.permissionOverwrites ? (
        'cache' in c.permissionOverwrites ? Array.from(c.permissionOverwrites.cache.values()).map((po: any) => ({
          id: po.id,
          allow: po.allow?.bitfield ? po.allow.bitfield.toString() : '0',
          deny: po.deny?.bitfield ? po.deny.bitfield.toString() : '0',
          type: po.type,
        })) : []
      ) : [],
    }));

    const snapshotData = {
      guildId: guild.id,
      guildName: guild.name,
      createdAt: new Date().toISOString(),
      roles: rolesData,
      channels: channelsData,
    };

    return await prisma.serverBackupSnapshot.create({
      data: {
        guildId: guild.id,
        name: name || `Бекап от ${new Date().toLocaleDateString('ru-RU')}`,
        createdById: createdById || null,
        createdByTag: createdByTag || null,
        dataJson: JSON.stringify(snapshotData),
        channelsCount: channelsData.length,
        rolesCount: rolesData.length,
      },
    });
  }

  /**
   * List all backup snapshots for guild
   */
  static async listSnapshots(guildId: string) {
    return await prisma.serverBackupSnapshot.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        guildId: true,
        name: true,
        createdById: true,
        createdByTag: true,
        channelsCount: true,
        rolesCount: true,
        createdAt: true,
      },
    });
  }
}
