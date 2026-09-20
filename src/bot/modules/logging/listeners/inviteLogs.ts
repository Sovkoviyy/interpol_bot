import { 
  Events, 
  Invite, 
  EmbedBuilder 
} from 'discord.js';
import bot from '../../../client';
import { AuditLogger } from '../auditLogger';

export function registerInviteLogs() {
  // Invite Create
  bot.on(Events.InviteCreate, async (invite: Invite) => {
    if (!invite.guild || !(invite.guild && 'id' in invite.guild)) return;
    const guild = bot.guilds.cache.get(invite.guild.id);
    if (!guild) return;

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🔗 Приглашение создано')
      .setDescription(
        `**Код:** \`${invite.code}\` ([Ссылка](${invite.url}))\n` +
        `**Создал:** ${invite.inviter ? `${invite.inviter} (\`${invite.inviter.tag}\`)` : 'Неизвестно'}\n` +
        `**Канал:** <#${invite.channelId}>\n` +
        `**Макс. использований:** ${invite.maxUses === 0 ? 'Бесконечно' : invite.maxUses}\n` +
        `**Истекает:** ${invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : 'Никогда'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendLog(guild, 'INVITES', embed);
  });

  // Invite Delete
  bot.on(Events.InviteDelete, async (invite: Invite) => {
    if (!invite.guild || !(invite.guild && 'id' in invite.guild)) return;
    const guild = bot.guilds.cache.get(invite.guild.id);
    if (!guild) return;

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🚫 Приглашение удалено/истекло')
      .setDescription(
        `**Код:** \`${invite.code}\`\n` +
        `**Канал:** <#${invite.channelId}>\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendLog(guild, 'INVITES', embed);
  });
}
