import { GuildMember, PartialGuildMember, EmbedBuilder } from 'discord.js';
import prisma from '../../../database/client';
import { AuditLogger } from '../logging/auditLogger';

export class RolePersistenceService {
  /**
   * Saves member roles and nickname when they leave or are kicked from the server
   */
  public static async saveMemberRoles(member: GuildMember | PartialGuildMember): Promise<void> {
    try {
      const guild = member.guild;
      if (!guild) return;

      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId: guild.id },
      });

      const shouldSaveRoles = guildConfig ? guildConfig.restoreRolesOnJoin : true;
      const shouldSaveNicks = guildConfig ? guildConfig.restoreNicknamesOnJoin : true;

      if (!shouldSaveRoles && !shouldSaveNicks) return;

      // Extract assignable roles (skip @everyone and managed/integration roles)
      const rolesToSave = shouldSaveRoles
        ? member.roles.cache
            .filter(r => r.id !== guild.id && !r.managed)
            .map(r => r.id)
        : [];

      // Extract nickname
      const nicknameToSave = ('nickname' in member ? member.nickname : null) || null;

      if (rolesToSave.length === 0 && !nicknameToSave) return;

      await prisma.savedMemberRoles.upsert({
        where: {
          guildId_userId: {
            guildId: guild.id,
            userId: member.id,
          },
        },
        update: {
          userTag: member.user?.tag || null,
          ...(shouldSaveNicks && nicknameToSave ? { nickname: nicknameToSave } : {}),
          ...(shouldSaveRoles ? { rolesJson: JSON.stringify(rolesToSave) } : {}),
          leftAt: new Date(),
        },
        create: {
          guildId: guild.id,
          userId: member.id,
          userTag: member.user?.tag || null,
          nickname: shouldSaveNicks ? nicknameToSave : null,
          rolesJson: shouldSaveRoles ? JSON.stringify(rolesToSave) : '[]',
          leftAt: new Date(),
        },
      });

      console.log(
        `💾 [Persistence] Saved ${rolesToSave.length} roles and nickname «${nicknameToSave || 'нет'}» for ${member.user?.tag || member.id}`
      );
    } catch (error) {
      console.error('[RolePersistence] Error saving member roles/nickname:', error);
    }
  }

  /**
   * Restores previously saved roles and nickname when a member rejoins the server
   */
  public static async restoreMemberRoles(member: GuildMember): Promise<string[]> {
    try {
      const guild = member.guild;
      if (!guild) return [];

      const guildConfig = await prisma.guildConfig.findUnique({
        where: { guildId: guild.id },
      });

      const restoreRoles = guildConfig ? guildConfig.restoreRolesOnJoin : true;
      const restoreNicks = guildConfig ? guildConfig.restoreNicknamesOnJoin : true;

      if (!restoreRoles && !restoreNicks) return [];

      const [saved, profile] = await Promise.all([
        prisma.savedMemberRoles.findUnique({
          where: {
            guildId_userId: {
              guildId: guild.id,
              userId: member.id,
            },
          },
        }),
        prisma.userProfile.findUnique({
          where: {
            guildId_userId: {
              guildId: guild.id,
              userId: member.id,
            },
          },
        }).catch(() => null),
      ]);

      let savedRoleIds: string[] = [];
      if (restoreRoles && saved?.rolesJson) {
        try {
          savedRoleIds = JSON.parse(saved.rolesJson);
        } catch {
          savedRoleIds = [];
        }
      }

      // Filter roles that still exist and bot can assign
      const botMember = guild.members.me;
      const botHighestRolePosition = botMember ? botMember.roles.highest.position : 0;

      const rolesToAssign = restoreRoles
        ? savedRoleIds.filter(roleId => {
            const role = guild.roles.cache.get(roleId);
            if (!role) return false;
            if (role.managed) return false;
            return role.position < botHighestRolePosition;
          })
        : [];

      const targetNickname = (restoreNicks ? (saved?.nickname || profile?.characterName) : null) || null;

      if (rolesToAssign.length > 0 || (targetNickname && member.nickname !== targetNickname)) {
        // Wait 1.5 seconds after join so Discord finishes initial member registration
        setTimeout(async () => {
          let rolesAdded = false;
          let nicknameRestored = false;

          try {
            // Restore roles
            if (rolesToAssign.length > 0) {
              await member.roles.add(rolesToAssign, 'Автоматическое восстановление ролей при возвращении на сервер');
              rolesAdded = true;
            }

            // Restore nickname
            if (targetNickname && member.nickname !== targetNickname && member.manageable) {
              await member.setNickname(targetNickname, 'Автоматическое восстановление никнейма').catch(err => {
                console.warn('[Persistence] Could not restore nickname:', err.message);
              });
              nicknameRestored = true;
            }

            // Log restoration
            if (rolesAdded || nicknameRestored) {
              const rolesFormatted = rolesToAssign.map(id => `<@&${id}>`).join(', ');
              const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('🔄 Автоматическое восстановление данных участника')
                .setDescription(
                  `**Участник:** ${member} (\`${member.user.tag}\` / \`${member.id}\`)\n` +
                  (rolesAdded ? `**Восстановлено ролей:** ${rolesFormatted}\n` : '') +
                  (nicknameRestored ? `**Восстановлен никнейм:** \`${targetNickname}\`\n` : '') +
                  (saved ? `**Покинул сервер ранее:** <t:${Math.floor(saved.leftAt.getTime() / 1000)}:R>\n` : '') +
                  `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
                )
                .setTimestamp();

              await AuditLogger.sendLog(guild, 'MEMBERS', embed);
              await AuditLogger.sendLog(guild, 'BOT', embed);
            }
          } catch (e) {
            console.error('[Persistence] Failed to restore roles/nickname:', e);
          }
        }, 1500);
      }

      return rolesToAssign;
    } catch (error) {
      console.error('[RolePersistence] Error restoring member data:', error);
      return [];
    }
  }
}
