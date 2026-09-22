import { 
  Events, 
  Message, 
  PartialMessage, 
  AuditLogEvent, 
  EmbedBuilder,
} from 'discord.js';
import bot from '../../../client';
import { AuditLogger } from '../auditLogger';
import prisma from '../../../../database/client';

interface CachedMessage {
  authorId: string;
  authorTag: string;
  authorAvatar?: string | null;
  content: string;
  channelId: string;
  createdAt: Date;
  attachments: string[];
}

// In-memory cache for recent messages (up to 3000 messages) to reliably catch deleted & edited contents
const messageCache = new Map<string, CachedMessage>();

export function registerMessageLogs() {
  // Track messages for delete/edit cache
  bot.on(Events.MessageCreate, (message: Message) => {
    if (message.author?.bot || !message.guild) return;

    if (messageCache.size >= 3000) {
      const oldestKey = messageCache.keys().next().value;
      if (oldestKey) messageCache.delete(oldestKey);
    }

    messageCache.set(message.id, {
      authorId: message.author.id,
      authorTag: message.author.tag,
      authorAvatar: message.author.displayAvatarURL(),
      content: message.content || '',
      channelId: message.channelId,
      createdAt: message.createdAt,
      attachments: Array.from(message.attachments.values()).map(a => a.url),
    });
  });

  // Message Delete
  bot.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
    const guild = message.guild || (message.guildId ? bot.guilds.cache.get(message.guildId) : null);
    if (!guild) return;

    // Check if logging is configured and skip deletion in the message-logs channel itself
    const logConfig = await prisma.loggingConfig.findUnique({
      where: { guildId: guild.id },
    }).catch(() => null);

    if (logConfig?.messageLogsChannelId && logConfig.messageLogsChannelId === message.channelId) {
      return;
    }

    // Retrieve cached data if available
    const cached = messageCache.get(message.id);
    const authorId = message.author?.id || cached?.authorId;
    const authorTag = message.author?.tag || cached?.authorTag;
    const isBot = message.author?.bot || (authorId && authorId === bot.user?.id);
    if (isBot) return;

    const content = message.content || cached?.content || '';
    const attachments = cached?.attachments || (message.attachments ? Array.from(message.attachments.values()).map(a => a.url) : []);

    const executor = await AuditLogger.getAuditLogExecutor(
      guild, 
      AuditLogEvent.MessageDelete, 
      authorId
    );

    const embed = new EmbedBuilder()
      .setColor(0xED4245) // Red
      .setTitle('🗑️ Сообщение удалено')
      .setDescription(
        `**Канал:** <#${message.channelId}>\n` +
        `**Автор сообщения:** ${authorId ? `<@${authorId}> (\`${authorTag || authorId}\`)` : 'Неизвестно (не было в кэше)'}\n` +
        `**Удалил:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Сам автор или бот без лога'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .addFields({
        name: 'Содержимое',
        value: content.length > 0 
          ? (content.length > 1000 ? content.slice(0, 1000) + '...' : content) 
          : '*(Вложения, эмбед или текст не сохранен в кэше)*',
      });

    if (attachments.length > 0) {
      embed.addFields({
        name: `Вложения (${attachments.length})`,
        value: attachments.slice(0, 5).join('\n'),
      });
    }

    embed.setFooter({ text: `ID сообщения: ${message.id}` }).setTimestamp();

    if (cached?.authorAvatar) {
      embed.setThumbnail(cached.authorAvatar);
    }

    // Clean from cache
    messageCache.delete(message.id);

    await AuditLogger.sendLog(guild, 'MESSAGES', embed);
  });

  // Message Edit
  bot.on(Events.MessageUpdate, async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
    const guild = newMessage.guild || (newMessage.guildId ? bot.guilds.cache.get(newMessage.guildId) : null);
    if (!guild) return;

    let fullNew = newMessage;
    if (fullNew.partial) {
      try {
        fullNew = await newMessage.fetch();
      } catch {
        return;
      }
    }

    if (fullNew.author?.bot) return;

    const cached = messageCache.get(newMessage.id);
    const oldContent = oldMessage.content || cached?.content || '';
    const newContent = fullNew.content || '';

    // Ignore if content did not change (e.g. Discord adding link previews/embeds)
    if (oldContent === newContent || (oldContent === '' && newContent === '')) return;

    // Update cache with latest content
    messageCache.set(newMessage.id, {
      authorId: fullNew.author.id,
      authorTag: fullNew.author.tag,
      authorAvatar: fullNew.author.displayAvatarURL(),
      content: newContent,
      channelId: fullNew.channelId,
      createdAt: fullNew.createdAt,
      attachments: Array.from(fullNew.attachments.values()).map(a => a.url),
    });

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C) // Yellow
      .setTitle('✏️ Сообщение отредактировано')
      .setDescription(
        `**Канал:** <#${newMessage.channelId}> ([Перейти к сообщению](${fullNew.url}))\n` +
        `**Автор:** ${fullNew.author} (\`${fullNew.author.tag}\`)\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .addFields(
        {
          name: 'До редактирования',
          value: oldContent.length > 0
            ? (oldContent.length > 1000 ? oldContent.slice(0, 1000) + '...' : oldContent)
            : '*(Ранее не было в кэше бота)*',
        },
        {
          name: 'После редактирования',
          value: newContent.length > 0
            ? (newContent.length > 1000 ? newContent.slice(0, 1000) + '...' : newContent)
            : '*(Пусто)*',
        }
      )
      .setFooter({ text: `ID: ${newMessage.id}` })
      .setTimestamp();

    await AuditLogger.sendLog(guild, 'MESSAGES', embed);
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

export default registerMessageLogs;
