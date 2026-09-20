import { 
  Events, 
  Role, 
  AuditLogEvent, 
  EmbedBuilder 
} from 'discord.js';
import bot from '../../../client';
import { AuditLogger } from '../auditLogger';

export function registerRoleLogs() {
  // Role Create
  bot.on(Events.GuildRoleCreate, async (role: Role) => {
    const executor = await AuditLogger.getAuditLogExecutor(
      role.guild,
      AuditLogEvent.RoleCreate,
      role.id
    );

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('➕ Роль создана')
      .setDescription(
        `**Роль:** ${role} (\`${role.name}\` / \`${role.id}\`)\n` +
        `**Цвет:** \`#${role.color.toString(16).padStart(6, '0')}\`\n` +
        `**Создал:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendLog(role.guild, 'ROLES', embed);
  });

  // Role Delete
  bot.on(Events.GuildRoleDelete, async (role: Role) => {
    const executor = await AuditLogger.getAuditLogExecutor(
      role.guild,
      AuditLogEvent.RoleDelete,
      role.id
    );

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('➖ Роль удалена')
      .setDescription(
        `**Название:** \`${role.name}\` (\`${role.id}\`)\n` +
        `**Удалил:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendLog(role.guild, 'ROLES', embed);
  });

  // Role Update
  bot.on(Events.GuildRoleUpdate, async (oldRole: Role, newRole: Role) => {
    const changes: string[] = [];

    if (oldRole.name !== newRole.name) {
      changes.push(`**Название:** \`${oldRole.name}\` ➔ \`${newRole.name}\``);
    }
    if (oldRole.color !== newRole.color) {
      changes.push(`**Цвет:** \`#${oldRole.color.toString(16)}\` ➔ \`#${newRole.color.toString(16)}\``);
    }
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      changes.push(`**Права изменены**`);
    }

    if (changes.length === 0) return;

    const executor = await AuditLogger.getAuditLogExecutor(
      newRole.guild,
      AuditLogEvent.RoleUpdate,
      newRole.id
    );

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🔧 Роль обновлена')
      .setDescription(
        `**Роль:** ${newRole} (\`${newRole.name}\` / \`${newRole.id}\`)\n` +
        `**Исполнитель:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
        changes.join('\n') + '\n' +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendLog(newRole.guild, 'ROLES', embed);
  });
}
