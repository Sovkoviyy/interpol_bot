import { 
  Events, 
  VoiceState, 
  EmbedBuilder 
} from 'discord.js';
import bot from '../../../client';
import { AuditLogger } from '../auditLogger';

export function registerVoiceLogs() {
  bot.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    const member = newState.member || oldState.member;
    const guild = newState.guild || oldState.guild;
    if (!member || !guild || member.user.bot) return;

    // 1. Joined voice
    if (!oldState.channelId && newState.channelId) {
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🔊 Вход в голосовой канал')
        .setDescription(
          `**Участник:** ${member} (\`${member.user.tag}\`)\n` +
          `**Канал:** <#${newState.channelId}>\n` +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();
      await AuditLogger.sendLog(guild, 'VOICE', embed);
      return;
    }

    // 2. Left voice
    if (oldState.channelId && !newState.channelId) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔈 Выход из голосового канала')
        .setDescription(
          `**Участник:** ${member} (\`${member.user.tag}\`)\n` +
          `**Канал:** <#${oldState.channelId}>\n` +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();
      await AuditLogger.sendLog(guild, 'VOICE', embed);
      return;
    }

    // 3. Moved voice channel
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🔀 Перемещение между войсами')
        .setDescription(
          `**Участник:** ${member} (\`${member.user.tag}\`)\n` +
          `**Было:** <#${oldState.channelId}>\n` +
          `**Стало:** <#${newState.channelId}>\n` +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();
      await AuditLogger.sendLog(guild, 'VOICE', embed);
      return;
    }

    // 4. Server Mute / Deafen changes
    if (oldState.serverMute !== newState.serverMute) {
      const embed = new EmbedBuilder()
        .setColor(newState.serverMute ? 0xE67E22 : 0x2ECC71)
        .setTitle(newState.serverMute ? '🔇 Серверный мут микрофона' : '🔊 Серверный мут снят')
        .setDescription(
          `**Участник:** ${member} (\`${member.user.tag}\`)\n` +
          `**Канал:** <#${newState.channelId}>\n` +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();
      await AuditLogger.sendLog(guild, 'VOICE', embed);
    }
  });
}
