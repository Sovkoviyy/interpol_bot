import { 
  Events, 
  Message, 
  PartialMessage, 
  AuditLogEvent, 
  EmbedBuilder, 
  Collection, 
  Snowflake 
} from 'discord.js';
import bot from '../../../client';
import { AuditLogger } from '../auditLogger';

export function registerMessageLogs() {
  // Message Delete
  bot.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
    if (!message.guild || message.author?.bot) return;

    const executor = await AuditLogger.getAuditLogExecutor(
      message.guild, 
      AuditLogEvent.MessageDelete, 
      message.author?.id
    );

    const embed = new EmbedBuilder()
      .setColor(0xED4245) // Red
      .setTitle('🗑️ Сообщение удалено')
      .setDescription(
        `**Канал:** <#${message.channelId}>\n` +
        `**Автор сообщения:** ${message.author ? `${message.author} (\`${message.author.tag}\` / \`${message.author.id}\`)` : 'Неизвестно'}\n` +
        `**Удалил:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Сам пользователь или не определено'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .addFields({
        name: 'Содержимое',
        value: message.content && message.content.length > 0 
          ? (message.content.length > 1000 ? message.content.slice(0, 1000) + '...' : message.content) 
          : '*(Вложения или пустое содержимое)*',
      })
      .setFooter({ text: `ID сообщения: ${message.id}` })
      .setTimestamp();

    await AuditLogger.sendLog(message.guild, 'MESSAGES', embed);
  });

  // Message Edit
  bot.on(Events.MessageUpdate, async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return; // Ignore embed-only updates

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C) // Yellow
      .setTitle('✏️ Сообщение отредактировано')
      .setDescription(
        `**Канал:** <#${newMessage.channelId}> ([Перейти к сообщению](${newMessage.url}))\n` +
        `**Автор:** ${newMessage.author ? `${newMessage.author} (\`${newMessage.author.tag}\`)` : 'Неизвестно'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .addFields(
        {
          name: 'До редактирования',
          value: oldMessage.content && oldMessage.content.length > 0
            ? (oldMessage.content.length > 1000 ? oldMessage.content.slice(0, 1000) + '...' : oldMessage.content)
            : '*(Неизвестно/пусто)*',
        },
        {
          name: 'После редактирования',
          value: newMessage.content && newMessage.content.length > 0
            ? (newMessage.content.length > 1000 ? newMessage.content.slice(0, 1000) + '...' : newMessage.content)
            : '*(Пусто)*',
        }
      )
      .setFooter({ text: `ID: ${newMessage.id}` })
      .setTimestamp();

    await AuditLogger.sendLog(newMessage.guild, 'MESSAGES', embed);
  });

  // Bulk Delete
  bot.on(Events.MessageBulkDelete, async (messages: any, channel: any) => {
    const firstMsg = messages.first ? messages.first() : null;
    const guild = firstMsg?.guild || ('guild' in channel ? channel.guild : null);
    if (!guild) return;

    const executor = await AuditLogger.getAuditLogExecutor(
      guild, 
      AuditLogEvent.MessageBulkDelete
    );

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🧹 Массовая очистка сообщений')
      .setDescription(
        `**Канал:** <#${channel.id}>\n` +
        `**Количество удаленных сообщений:** ${messages.size}\n` +
        `**Очистил:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendLog(guild, 'MESSAGES', embed);
  });
}
