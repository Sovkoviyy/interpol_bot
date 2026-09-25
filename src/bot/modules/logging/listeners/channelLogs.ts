import { 
  Events, 
  AuditLogEvent, 
  EmbedBuilder, 
  ChannelType
} from 'discord.js';
import bot from '../../../client';
import { AuditLogger } from '../auditLogger';

export function registerChannelLogs() {
  // Channel Create
  bot.on(Events.ChannelCreate, async (channel: any) => {
    if (!channel.guild) return;

    const executor = await AuditLogger.getAuditLogExecutor(
      channel.guild,
      AuditLogEvent.ChannelCreate,
      channel.id
    );

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('📁 Канал создан')
      .setDescription(
        `**Канал:** <#${channel.id}> (\`${channel.name}\` / \`${channel.id}\`)\n` +
        `**Тип:** \`${ChannelType[channel.type]}\`\n` +
        (channel.parent ? `**Категория:** \`${channel.parent.name}\`\n` : '') +
        `**Создал:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendHumanOrBotLog(channel.guild, 'CHANNELS', executor, embed);
  });

  // Channel Delete
  bot.on(Events.ChannelDelete, async (channel: any) => {
    if (!channel.guild) return;

    const executor = await AuditLogger.getAuditLogExecutor(
      channel.guild,
      AuditLogEvent.ChannelDelete,
      channel.id
    );

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🗑️ Канал удален')
      .setDescription(
        `**Название:** \`${channel.name || 'Неизвестно'}\` (\`${channel.id}\`)\n` +
        `**Тип:** \`${ChannelType[channel.type]}\`\n` +
        `**Удалил:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendHumanOrBotLog(channel.guild, 'CHANNELS', executor, embed);
  });

  // Channel Update
  bot.on(Events.ChannelUpdate, async (oldChannel: any, newChannel: any) => {
    if (!newChannel.guild) return;

    const changes: string[] = [];
    if (oldChannel.name !== newChannel.name) {
      changes.push(`**Название:** \`${oldChannel.name}\` ➔ \`${newChannel.name}\``);
    }

    if ('topic' in oldChannel && 'topic' in newChannel && oldChannel.topic !== newChannel.topic) {
      changes.push(`**Тема канала изменена**`);
    }

    if (changes.length === 0) return;

    const executor = await AuditLogger.getAuditLogExecutor(
      newChannel.guild,
      AuditLogEvent.ChannelUpdate,
      newChannel.id
    );

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('⚙️ Канал обновлен')
      .setDescription(
        `**Канал:** <#${newChannel.id}>\n` +
        `**Исполнитель:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
        changes.join('\n') + '\n' +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendHumanOrBotLog(newChannel.guild, 'CHANNELS', executor, embed);
  });
}
