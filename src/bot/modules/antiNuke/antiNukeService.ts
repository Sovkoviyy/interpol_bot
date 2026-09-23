import { 
  Guild, 
  GuildChannel, 
  DMChannel, 
  AuditLogEvent, 
  EmbedBuilder, 
  ChannelType, 
  PermissionOverwrites, 
  Role 
} from 'discord.js';
import prisma from '../../../database/client';

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

      const alertEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🚨 СРАБОТАЛА ЗАЩИТА СЕРВЕРА (ANTI-NUKE)')
        .setDescription(
          `**Удален канал:** \`#${channel.name}\` (ID: \`${channel.id}\`)\n` +
          `**Нарушитель:** <@${executor.id}> (\`${executor.tag}\` / \`${executor.id}\`)\n` +
          `**Примененные меры:**\n` +
          `• ❌ С нарушителя сняты все роли доступа на сервере.\n` +
          (restoredChannel ? `• 🔄 Канал успешно восстановлен: ${restoredChannel}\n` : `• ⚠️ Не удалось восстановить канал автоматически.\n`)
        )
        .setThumbnail(executor.displayAvatarURL())
        .setTimestamp();

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
        const alertChannel = guild.channels.cache.get(config.alertChannelId);
        if (alertChannel && alertChannel.isTextBased()) {
          await (alertChannel as any).send({ embeds: [alertEmbed] }).catch(() => null);
        }
      }
    } catch (err) {
      console.error('[AntiNuke] Critical error in handler:', err);
    }
  }

  /**
   * Create a full server snapshot backup (categories, channels, roles, permissions)
   */
  static async createSnapshot(guild: Guild, name: string, createdById?: string, createdByTag?: string) {
    const rolesData = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        hoist: r.hoist,
        permissions: r.permissions.bitfield.toString(),
        position: r.position,
        mentionable: r.mentionable,
      }));

    const channelsData = guild.channels.cache.map((c: any) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      parentId: c.parentId,
      position: c.rawPosition ?? 0,
      topic: c.topic || null,
      permissionOverwrites: c.permissionOverwrites ? c.permissionOverwrites.cache.map((po: any) => ({
        id: po.id,
        allow: po.allow.bitfield.toString(),
        deny: po.deny.bitfield.toString(),
        type: po.type,
      })) : [],
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
