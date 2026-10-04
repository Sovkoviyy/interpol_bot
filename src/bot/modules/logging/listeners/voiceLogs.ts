import { 
  Events, 
  VoiceState, 
  EmbedBuilder,
  AuditLogEvent 
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
          `**Участник:** ${member} (\`${member.user.tag}\` / \`${member.id}\`)\n` +
          `**Канал:** <#${newState.channelId}>\n` +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();

      await AuditLogger.sendLog(guild, 'VOICE', embed, {
        action: 'VOICE_JOIN',
        targetId: member.id,
        targetTag: member.user.tag,
        details: `Вход в голосовой канал #${newState.channel?.name || newState.channelId}`,
        metadata: { channelId: newState.channelId, channelName: newState.channel?.name },
      });
      return;
    }

    // 2. Left voice / Disconnected
    if (oldState.channelId && !newState.channelId) {
      // Check if disconnected by a moderator
      const disconnectEntry = await AuditLogger.getAuditLogEntry(
        guild,
        AuditLogEvent.MemberDisconnect,
        member.id
      );
      const isModDisconnect = Boolean(disconnectEntry?.executor && disconnectEntry.executor.id !== member.id);
      const executor = isModDisconnect ? disconnectEntry?.executor : null;

      const embed = new EmbedBuilder()
        .setColor(isModDisconnect ? 0xED4245 : 0x95A5A6)
        .setTitle(isModDisconnect ? '🛑 Принудительно отключен из войса' : '🔈 Выход из голосового канала')
        .setDescription(
          `**Участник:** ${member} (\`${member.user.tag}\` / \`${member.id}\`)\n` +
          `**Канал:** <#${oldState.channelId}>\n` +
          (isModDisconnect ? `**Отключил модератор:** ${executor} (\`${executor?.tag}\`)\n` : '') +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();

      await AuditLogger.sendLog(guild, 'VOICE', embed, {
        action: isModDisconnect ? 'VOICE_DISCONNECT_MOD' : 'VOICE_LEAVE',
        executorId: executor?.id || member.id,
        executorTag: executor?.tag || member.user.tag,
        targetId: member.id,
        targetTag: member.user.tag,
        details: isModDisconnect
          ? `Принудительно отключен из войса #${oldState.channel?.name || oldState.channelId} модератором @${executor?.tag || 'Неизвестно'}`
          : `Выход из голосового канала #${oldState.channel?.name || oldState.channelId}`,
        metadata: {
          channelId: oldState.channelId,
          channelName: oldState.channel?.name,
          isModDisconnect,
        },
      });
      return;
    }

    // 3. Moved voice channel
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      // Check if moved by moderator
      const moveEntry = await AuditLogger.getAuditLogEntry(
        guild,
        AuditLogEvent.MemberMove,
        undefined,
        e => (e.extra as any)?.channel?.id === newState.channelId
      );
      const isModMove = Boolean(moveEntry?.executor && moveEntry.executor.id !== member.id);
      const executor = isModMove ? moveEntry?.executor : null;

      const embed = new EmbedBuilder()
        .setColor(isModMove ? 0x9B59B6 : 0x3498DB)
        .setTitle(isModMove ? '🔀 Принудительно перемещен модератором' : '🔀 Перемещение между войсами')
        .setDescription(
          `**Участник:** ${member} (\`${member.user.tag}\` / \`${member.id}\`)\n` +
          `**Было:** <#${oldState.channelId}>\n` +
          `**Стало:** <#${newState.channelId}>\n` +
          (isModMove ? `**Переместил модератор:** ${executor} (\`${executor?.tag}\`)\n` : '') +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();

      await AuditLogger.sendLog(guild, 'VOICE', embed, {
        action: isModMove ? 'VOICE_MOVE_MOD' : 'VOICE_MOVE',
        executorId: executor?.id || member.id,
        executorTag: executor?.tag || member.user.tag,
        targetId: member.id,
        targetTag: member.user.tag,
        details: isModMove
          ? `Перемещен модератором @${executor?.tag} из #${oldState.channel?.name} в #${newState.channel?.name}`
          : `Перемещение из #${oldState.channel?.name} в #${newState.channel?.name}`,
        metadata: {
          fromChannelId: oldState.channelId,
          toChannelId: newState.channelId,
          isModMove,
        },
      });
      return;
    }

    // 4. Server Mute changes in Voice
    if (oldState.serverMute !== newState.serverMute) {
      const muteEntry = await AuditLogger.getAuditLogEntry(
        guild,
        AuditLogEvent.MemberUpdate,
        member.id,
        e => e.changes?.some(c => c.key === 'mute')
      );
      const executor = muteEntry?.executor || null;

      const embed = new EmbedBuilder()
        .setColor(newState.serverMute ? 0xE67E22 : 0x2ECC71)
        .setTitle(newState.serverMute ? '🔇 Серверный мут микрофона в войсе' : '🔊 Серверный мут микрофона снят')
        .setDescription(
          `**Участник:** ${member} (\`${member.user.tag}\` / \`${member.id}\`)\n` +
          `**Канал:** <#${newState.channelId || oldState.channelId}>\n` +
          `**Модератор:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();

      await AuditLogger.sendHumanOrBotLog(guild, 'VOICE', executor, embed, {
        action: newState.serverMute ? 'VOICE_SERVER_MUTE' : 'VOICE_SERVER_UNMUTE',
        executorId: executor?.id,
        executorTag: executor?.tag,
        targetId: member.id,
        targetTag: member.user.tag,
        details: newState.serverMute
          ? `Серверный мут микрофона в войсе выдан модератором @${executor?.tag || 'Неизвестно'}`
          : `Серверный мут микрофона в войсе снят модератором @${executor?.tag || 'Неизвестно'}`,
        metadata: {
          serverMute: newState.serverMute,
          channelId: newState.channelId || oldState.channelId,
        },
      });
    }

    // 5. Server Deafen changes in Voice
    if (oldState.serverDeaf !== newState.serverDeaf) {
      const deafEntry = await AuditLogger.getAuditLogEntry(
        guild,
        AuditLogEvent.MemberUpdate,
        member.id,
        e => e.changes?.some(c => c.key === 'deaf')
      );
      const executor = deafEntry?.executor || null;

      const embed = new EmbedBuilder()
        .setColor(newState.serverDeaf ? 0xED4245 : 0x2ECC71)
        .setTitle(newState.serverDeaf ? '🛑 Серверное отключение звука (Деф)' : '🎧 Серверное отключение звука снято')
        .setDescription(
          `**Участник:** ${member} (\`${member.user.tag}\` / \`${member.id}\`)\n` +
          `**Канал:** <#${newState.channelId || oldState.channelId}>\n` +
          `**Модератор:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();

      await AuditLogger.sendHumanOrBotLog(guild, 'VOICE', executor, embed, {
        action: newState.serverDeaf ? 'VOICE_SERVER_DEAF' : 'VOICE_SERVER_UNDEAF',
        executorId: executor?.id,
        executorTag: executor?.tag,
        targetId: member.id,
        targetTag: member.user.tag,
        details: newState.serverDeaf
          ? `Серверный деф (отключение звука) выдан модератором @${executor?.tag || 'Неизвестно'}`
          : `Серверный деф (отключение звука) снят модератором @${executor?.tag || 'Неизвестно'}`,
        metadata: {
          serverDeaf: newState.serverDeaf,
          channelId: newState.channelId || oldState.channelId,
        },
      });
    }

    // 6. Streaming / Screen Share
    if (oldState.streaming !== newState.streaming) {
      const embed = new EmbedBuilder()
        .setColor(newState.streaming ? 0x9B59B6 : 0x7F8C8D)
        .setTitle(newState.streaming ? '📺 Начата трансляция экрана' : '📺 Трансляция экрана завершена')
        .setDescription(
          `**Участник:** ${member} (\`${member.user.tag}\`)\n` +
          `**Канал:** <#${newState.channelId || oldState.channelId}>\n` +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();

      await AuditLogger.sendLog(guild, 'VOICE', embed, {
        action: newState.streaming ? 'VOICE_STREAM_START' : 'VOICE_STREAM_STOP',
        targetId: member.id,
        targetTag: member.user.tag,
        details: newState.streaming ? `Начата демонстрация экрана` : `Демонстрация экрана завершена`,
      });
    }
  });
}
