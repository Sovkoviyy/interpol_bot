import { GuildMember, PartialGuildMember, EmbedBuilder } from 'discord.js';
import prisma from '../../../database/client';
import { AuditLogger } from '../logging/auditLogger';

export class RolePersistenceService {
  /**
   * Saves member roles when they leave or are kicked from the server
   */
  public static async saveMemberRoles(member: GuildMember | PartialGuildMember): Promise<void> {
    try {
      const guild = member.guild;
      if (!guild) return;

      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId: guild.id },
      });

      if (guildConfig && !guildConfig.restoreRolesOnJoin) return;

      // Extract assignable roles (skip @everyone and managed/integration roles)
      const rolesToSave = member.roles.cache
        .filter(r => r.id !== guild.id && !r.managed)
        .map(r => r.id);

      if (rolesToSave.length === 0) return;

      await prisma.savedMemberRoles.upsert({
        where: {
          guildId_userId: {
            guildId: guild.id,
            userId: member.id,
          },
        },
        update: {
          userTag: member.user?.tag || null,
          nickname: ('nickname' in member ? member.nickname : null) || null,
          rolesJson: JSON.stringify(rolesToSave),
          leftAt: new Date(),
        },
        create: {
          guildId: guild.id,
          userId: member.id,
          userTag: member.user?.tag || null,
          nickname: ('nickname' in member ? member.nickname : null) || null,
          rolesJson: JSON.stringify(rolesToSave),
          leftAt: new Date(),
        },
      });

      console.log(`💾 [RolePersistence] Saved ${rolesToSave.length} roles for user ${member.id} (${member.user?.tag})`);
    } catch (error) {
      console.error('[RolePersistence] Error saving member roles:', error);
    }
  }

  /**
   * Restores previously saved roles when a member rejoins the server
   */
  public static async restoreMemberRoles(member: GuildMember): Promise<string[]> {
    try {
      const guild = member.guild;
      if (!guild) return [];

      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId: guild.id },
      });

      if (guildConfig && !guildConfig.restoreRolesOnJoin) return [];

      const saved = await prisma.savedMemberRoles.findUnique({
        where: {
          guildId_userId: {
            guildId: guild.id,
            userId: member.id,
          },
        },
      });

      if (!saved || !saved.rolesJson) return [];

      let savedRoleIds: string[] = [];
      try {
        savedRoleIds = JSON.parse(saved.rolesJson);
      } catch {
        return [];
      }

      if (savedRoleIds.length === 0) return [];

      // Filter roles that still exist and bot can assign
      const botMember = guild.members.me;
      const botHighestRolePosition = botMember ? botMember.roles.highest.position : 0;

      const rolesToAssign = savedRoleIds.filter(roleId => {
        const role = guild.roles.cache.get(roleId);
        if (!role) return false;
        if (role.managed) return false;
        // Bot must have higher role position to assign it
        return role.position < botHighestRolePosition;
      });

      if (rolesToAssign.length > 0) {
        // Wait 1.5 seconds after join so Discord finishes initial member setup
        setTimeout(async () => {
          try {
            await member.roles.add(rolesToAssign, 'Автоматическое восстановление ролей при возвращении на сервер');

            // Restore nickname if saved and member has default name
            if (saved.nickname && !member.nickname && member.manageable) {
              await member.setNickname(saved.nickname, 'Восстановление прошлого никнейма').catch(() => null);
            }

            // Log restoration to members and bot logs
            const rolesFormatted = rolesToAssign.map(id => `<@&${id}>`).join(', ');
            const embed = new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle('🔄 Роли участника автоматически восстановлены')
              .setDescription(
                `**Участник:** ${member} (\`${member.user.tag}\` / \`${member.id}\`)\n` +
                `**Восстановлено ролей:** ${rolesFormatted}\n` +
                (saved.nickname ? `**Восстановленный ник:** \`${saved.nickname}\`\n` : '') +
                `**Покинул сервер ранее:** <t:${Math.floor(saved.leftAt.getTime() / 1000)}:R>\n` +
                `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
              )
              .setTimestamp();

            await AuditLogger.sendLog(guild, 'MEMBERS', embed);
            await AuditLogger.sendLog(guild, 'BOT', embed);
          } catch (e) {
            console.error('[RolePersistence] Failed to assign restored roles:', e);
          }
        }, 1500);
      }

      return rolesToAssign;
    } catch (error) {
      console.error('[RolePersistence] Error restoring member roles:', error);
      return [];
    }
  }
}
