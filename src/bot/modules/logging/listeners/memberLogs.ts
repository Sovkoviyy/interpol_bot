import { 
  Events, 
  GuildMember, 
  PartialGuildMember, 
  AuditLogEvent, 
  EmbedBuilder, 
  GuildBan 
} from 'discord.js';
import bot from '../../../client';
import { AuditLogger } from '../auditLogger';
import { RolePersistenceService } from '../../roles/rolePersistenceService';

export function registerMemberLogs() {
  // Member Join
  bot.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    // Restore roles if member was previously in server
    await RolePersistenceService.restoreMemberRoles(member);

    // Track invite link used to join
    const inviteInfo = await import('./inviteLogs').then(m => m.trackMemberJoinInvite(member)).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(0x57F287) // Green
      .setTitle('📥 Новый участник присоединился')
      .setDescription(
        `**Пользователь:** ${member} (\`${member.user.tag}\` / \`${member.id}\`)\n` +
        (inviteInfo ? `**Инвайт:** \`${inviteInfo.code}\`${inviteInfo.inviterTag ? ` (пригласил: \`${inviteInfo.inviterTag}\`)` : ''}\n` : '') +
        `**Возраст аккаунта:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n` +
        `**Всего участников:** ${member.guild.memberCount}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    await AuditLogger.sendLog(member.guild, 'MEMBERS', embed);
  });

  // Member Leave / Kick
  bot.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    // Save roles before member leaves
    await RolePersistenceService.saveMemberRoles(member);

    const kickExecutor = await AuditLogger.getAuditLogExecutor(
      member.guild, 
      AuditLogEvent.MemberKick, 
      member.id
    );

    const isKicked = !!kickExecutor;

    const embed = new EmbedBuilder()
      .setColor(isKicked ? 0xED4245 : 0x95A5A6)
      .setTitle(isKicked ? '🥾 Участник был кикнут' : '📤 Участник покинул сервер')
      .setDescription(
        `**Пользователь:** ${member.user?.tag || member.id} (\`${member.id}\`)\n` +
        (isKicked ? `**Инициатор кика:** ${kickExecutor} (\`${kickExecutor.tag}\`)\n` : '') +
        `**Всего участников:** ${member.guild.memberCount}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setThumbnail(member.user?.displayAvatarURL({ size: 256 }) || null)
      .setTimestamp();

    await AuditLogger.sendLog(member.guild, 'MEMBERS', embed);
  });

  // Member Ban
  bot.on(Events.GuildBanAdd, async (ban: GuildBan) => {
    const banExecutor = await AuditLogger.getAuditLogExecutor(
      ban.guild,
      AuditLogEvent.MemberBanAdd,
      ban.user.id
    );

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔨 Пользователь забанен')
      .setDescription(
        `**Пользователь:** ${ban.user} (\`${ban.user.tag}\` / \`${ban.user.id}\`)\n` +
        `**Забанил:** ${banExecutor ? `${banExecutor} (\`${banExecutor.tag}\`)` : 'Неизвестно'}\n` +
        `**Причина:** ${ban.reason || 'Не указана'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    await AuditLogger.sendLog(ban.guild, 'MEMBERS', embed);
  });

  // Member Unban
  bot.on(Events.GuildBanRemove, async (ban: GuildBan) => {
    const unbanExecutor = await AuditLogger.getAuditLogExecutor(
      ban.guild,
      AuditLogEvent.MemberBanRemove,
      ban.user.id
    );

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🔓 Пользователь разбанен')
      .setDescription(
        `**Пользователь:** ${ban.user} (\`${ban.user.tag}\` / \`${ban.user.id}\`)\n` +
        `**Разбанил:** ${unbanExecutor ? `${unbanExecutor} (\`${unbanExecutor.tag}\`)` : 'Неизвестно'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendLog(ban.guild, 'MEMBERS', embed);
  });

  // Member Update (Nickname, Roles, Timeout)
  bot.on(Events.GuildMemberUpdate, async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    // 1. Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🏷️ Изменен никнейм')
        .setDescription(
          `**Участник:** ${newMember} (\`${newMember.user.tag}\`)\n` +
          `**Было:** \`${oldMember.nickname || oldMember.user?.username || 'Нет'}\`\n` +
          `**Стало:** \`${newMember.nickname || newMember.user.username}\`\n` +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();
      await AuditLogger.sendLog(newMember.guild, 'MEMBERS', embed);
    }

    // 2. Roles added / removed
    const oldRoles = new Set(oldMember.roles.cache.keys());
    const newRoles = new Set(newMember.roles.cache.keys());

    const addedRoles = [...newRoles].filter(r => !oldRoles.has(r));
    const removedRoles = [...oldRoles].filter(r => !newRoles.has(r));

    if (addedRoles.length > 0 || removedRoles.length > 0) {
      const executor = await AuditLogger.getAuditLogExecutor(
        newMember.guild,
        AuditLogEvent.MemberRoleUpdate,
        newMember.id
      );

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🛡️ Изменение ролей участника')
        .setDescription(
          `**Участник:** ${newMember} (\`${newMember.user.tag}\`)\n` +
          `**Исполнитель:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
          (addedRoles.length > 0 ? `**Выданы роли:** ${addedRoles.map(r => `<@&${r}>`).join(', ')}\n` : '') +
          (removedRoles.length > 0 ? `**Сняты роли:** ${removedRoles.map(r => `<@&${r}>`).join(', ')}\n` : '') +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();

      await AuditLogger.sendLog(newMember.guild, 'ROLES', embed);
    }

    // 3. Timeout (communication disabled)
    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
      const executor = await AuditLogger.getAuditLogExecutor(
        newMember.guild,
        AuditLogEvent.MemberUpdate,
        newMember.id
      );

      const isMuted = newMember.isCommunicationDisabled();
      const embed = new EmbedBuilder()
        .setColor(isMuted ? 0xE67E22 : 0x2ECC71)
        .setTitle(isMuted ? '⏳ Участнику выдан тайм-аут' : '⌛ Тайм-аут снят')
        .setDescription(
          `**Участник:** ${newMember} (\`${newMember.user.tag}\`)\n` +
          `**Модератор:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
          (isMuted ? `**До:** <t:${Math.floor(newMember.communicationDisabledUntilTimestamp! / 1000)}:F> (<t:${Math.floor(newMember.communicationDisabledUntilTimestamp! / 1000)}:R>)\n` : '') +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();

      await AuditLogger.sendLog(newMember.guild, 'MEMBERS', embed);
    }
  });
}
