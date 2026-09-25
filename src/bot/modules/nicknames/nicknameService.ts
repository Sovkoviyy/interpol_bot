import { Guild, GuildMember, PermissionFlagsBits } from 'discord.js';
import prisma from '../../../database/client';
import { AuditLogger } from '../logging/auditLogger';
import { extractFirstName } from '../../utils/nameUtils';

export interface UserMainCharacterInfo {
  characterName: string;
  staticId: string;
  rank: number;
}

export class NicknameService {
  /**
   * Get or create nickname configuration for a guild
   */
  public static async getConfig(guildId: string) {
    let cfg = await prisma.nicknameConfig.findUnique({
      where: { guildId },
    });
    if (!cfg) {
      cfg = await prisma.nicknameConfig.create({
        data: {
          guildId,
          enabled: true,
          defaultFormat: '{prefix} | {name} | {static}',
          defaultPrefix: '1',
          fallbackFormat: '{name} | {static}',
        },
      });
    }
    return cfg;
  }

  /**
   * Get user's primary character from UserProfile & UserCharacter
   */
  public static async getUserMainCharacter(guildId: string, userId: string): Promise<UserMainCharacterInfo | null> {
    const profile = await prisma.userProfile.findUnique({
      where: { guildId_userId: { guildId, userId } },
      include: { characters: true },
    });

    if (!profile) return null;

    let characterName = profile.characterName;
    let staticId = profile.staticId;

    if (profile.characters && profile.characters.length > 0) {
      const mainChar = profile.characters.find(c => c.isMain) || profile.characters[0];
      if (mainChar) {
        if (mainChar.characterName) characterName = mainChar.characterName;
        if (mainChar.staticId) staticId = mainChar.staticId;
      }
    }

    if (!characterName && !staticId) {
      return null;
    }

    return {
      characterName: characterName || 'Неизвестно',
      staticId: staticId || '0000',
      rank: profile.rank || 1,
    };
  }

  /**
   * Compute expected nickname string based on role bindings and main profile
   */
  public static async computeExpectedNickname(guildId: string, member: GuildMember): Promise<string | null> {
    const mainChar = await this.getUserMainCharacter(guildId, member.id);
    if (!mainChar) return null;

    const cfg = await this.getConfig(guildId);
    if (!cfg.enabled) return null;

    // 1. Check custom configured RoleNicknameBindings
    const bindings = await prisma.roleNicknameBinding.findMany({
      where: { guildId },
      orderBy: { priority: 'desc' },
    });

    let matchedBinding: any = null;
    for (const b of bindings) {
      if (member.roles?.cache?.has(b.roleId)) {
        matchedBinding = b;
        break;
      }
    }

    let prefix = '';
    let format = cfg.defaultFormat || '{prefix} | {name} | {static}';

    if (matchedBinding) {
      prefix = matchedBinding.prefix;
      if (matchedBinding.format) format = matchedBinding.format;
    } else {
      // 2. Check Academy roles as built-in default
      const academyCfg = await prisma.academyConfig.findUnique({ where: { guildId } }).catch(() => null);
      if (academyCfg) {
        if (academyCfg.academicRoleId && member.roles?.cache?.has(academyCfg.academicRoleId)) {
          prefix = '1';
        } else if (academyCfg.promotedRoleId && member.roles?.cache?.has(academyCfg.promotedRoleId)) {
          prefix = '2';
        }
      }

      if (!prefix) {
        // Fallback format when no specific role matched
        format = cfg.fallbackFormat || '{name} | {static}';
        prefix = cfg.defaultPrefix || String(mainChar.rank || '1');
      }
    }

    // Extract strictly the first name (without surname)
    const firstName = extractFirstName(mainChar.characterName || member.displayName || member.user.username);

    // Apply template replacements
    let nick = format
      .replace(/{prefix}/g, prefix)
      .replace(/{name}/g, firstName)
      .replace(/{static}/g, mainChar.staticId)
      .trim();

    // Clean up empty prefix separators like "| Richard Miller | 12345" -> "Richard Miller | 12345"
    nick = nick.replace(/^\s*\|\s*/, '').trim();

    // Discord nickname limit is 32 characters
    if (nick.length > 32) {
      nick = nick.substring(0, 32);
    }

    return nick;
  }

  /**
   * Check if a member can have their nickname managed by the bot
   */
  public static canManageNickname(member: GuildMember): boolean {
    if (!member || !member.guild) return false;
    if (member.id === member.guild.ownerId) return false;
    if (member.user?.bot) return false;

    const me = member.guild.members?.me;
    if (!me || !me.permissions || typeof me.permissions.has !== 'function') return false;
    if (!me.permissions.has(PermissionFlagsBits.ManageNicknames)) return false;

    // Bot's highest role must be strictly higher than the target member's highest role
    const mePos = me.roles?.highest?.position ?? 0;
    const memberPos = member.roles?.highest?.position ?? 0;
    return mePos > memberPos;
  }

  /**
   * Automatically synchronize a member's nickname based on their roles and main character
   */
  public static async syncMemberNickname(
    member: GuildMember, 
    reason: string = 'Автоматическая синхронизация ника по роли'
  ): Promise<{ updated: boolean; oldNick?: string | null; newNick?: string; reason?: string }> {
    try {
      if (!this.canManageNickname(member)) {
        return { updated: false, reason: 'Недостаточно прав для смены ника (выше в иерархии ролей или владелец)' };
      }

      const targetNick = await this.computeExpectedNickname(member.guild.id, member);
      if (!targetNick) {
        return { updated: false, reason: 'Нет привязанного основного профиля/статика или отключено' };
      }

      const currentNick = member.nickname || member.user.username;
      if (currentNick === targetNick) {
        return { updated: false, oldNick: currentNick, newNick: targetNick, reason: 'Никнейм уже актуален' };
      }

      await member.setNickname(targetNick, reason);

      await AuditLogger.recordEntry({
        guildId: member.guild.id,
        category: 'MEMBERS',
        action: 'NICKNAME_AUTO_SYNC',
        title: 'Автоматическая смена ника',
        description: `Сменен никнейм для ${member.user.tag}: «${currentNick}» ➔ «${targetNick}» (${reason})`,
        targetId: member.id,
        targetTag: member.user.tag,
      }).catch(() => null);

      return { updated: true, oldNick: currentNick, newNick: targetNick };
    } catch (err: any) {
      console.warn(`[NicknameService] Failed to set nickname for ${member.id}:`, err.message);
      return { updated: false, reason: err.message };
    }
  }

  /**
   * Manually set a member's nickname from website or bot command
   */
  public static async manualSetNickname(
    guild: Guild,
    userId: string,
    newNickname: string,
    executorTag: string = 'Администратор'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return { success: false, error: 'Пользователь не найден на сервере' };
      }

      if (!this.canManageNickname(member)) {
        return { success: false, error: 'Бот не может изменить ник этому участнику (роль участника выше роли бота)' };
      }

      const oldNick = member.nickname || member.user.username;
      const cleanNick = newNickname.trim().substring(0, 32);

      await member.setNickname(cleanNick, `Установлен вручную администратором ${executorTag}`);

      await AuditLogger.recordEntry({
        guildId: guild.id,
        category: 'MEMBERS',
        action: 'NICKNAME_MANUAL_SET',
        title: 'Ручная смена никнейма',
        description: `Администратор ${executorTag} сменил ник для ${member.user.tag}: «${oldNick}» ➔ «${cleanNick}»`,
        targetId: member.id,
        targetTag: member.user.tag,
      }).catch(() => null);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Batch synchronize all guild members with slight delay for rate-limits
   */
  public static async syncAllGuildMembers(guild: Guild): Promise<{
    total: number;
    updated: number;
    skipped: number;
    errors: number;
  }> {
    const members = await guild.members.fetch().catch(() => guild.members.cache);
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const member of members.values()) {
      if (member.user.bot) continue;

      const res = await this.syncMemberNickname(member, 'Массовая синхронизация никнеймов');
      if (res.updated) {
        updated++;
        // Small delay to prevent Discord API 429
        await new Promise(r => setTimeout(r, 150));
      } else if (res.reason?.includes('Недостаточно прав') || res.reason?.includes('Failed')) {
        errors++;
      } else {
        skipped++;
      }
    }

    return {
      total: members.size,
      updated,
      skipped,
      errors,
    };
  }
}
