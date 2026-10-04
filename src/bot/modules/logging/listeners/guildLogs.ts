import { 
  Events, 
  Guild, 
  GuildEmoji, 
  Sticker, 
  AuditLogEvent, 
  EmbedBuilder 
} from 'discord.js';
import bot from '../../../client';
import { AuditLogger } from '../auditLogger';

export function registerGuildLogs() {
  // Guild Update (Name, Icon, Verification level, AFK channel, etc.)
  bot.on(Events.GuildUpdate, async (oldGuild: Guild, newGuild: Guild) => {
    const changes: string[] = [];

    if (oldGuild.name !== newGuild.name) {
      changes.push(`**Название:** \`${oldGuild.name}\` ➔ \`${newGuild.name}\``);
    }
    if (oldGuild.icon !== newGuild.icon) {
      changes.push('**Иконка сервера изменена**');
    }
    if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
      changes.push(`**AFK канал:** <#${oldGuild.afkChannelId || 'нет'}> ➔ <#${newGuild.afkChannelId || 'нет'}>`);
    }
    if (oldGuild.systemChannelId !== newGuild.systemChannelId) {
      changes.push(`**Системный канал:** <#${oldGuild.systemChannelId || 'нет'}> ➔ <#${newGuild.systemChannelId || 'нет'}>`);
    }

    if (changes.length === 0) return;

    const guildEntry = await AuditLogger.getAuditLogEntry(
      newGuild,
      AuditLogEvent.GuildUpdate
    );
    const executor = guildEntry?.executor || null;

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🏰 Настройки сервера обновлены')
      .setDescription(
        `**Сервер:** \`${newGuild.name}\`\n` +
        `**Исполнитель:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
        changes.join('\n') + '\n' +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    if (newGuild.iconURL()) {
      embed.setThumbnail(newGuild.iconURL()!);
    }

    await AuditLogger.sendHumanOrBotLog(newGuild, 'CHANNELS', executor, embed, {
      action: 'GUILD_UPDATE',
      executorId: executor?.id,
      executorTag: executor?.tag,
      targetId: newGuild.id,
      targetTag: newGuild.name,
      details: `Обновление настроек сервера: ${changes.join(', ')} (${executor ? `изменил @${executor.tag}` : 'неизвестно'})`,
      metadata: { changes },
    });
  });

  // Emoji Create
  bot.on(Events.GuildEmojiCreate, async (emoji: GuildEmoji) => {
    const entry = await AuditLogger.getAuditLogEntry(
      emoji.guild,
      AuditLogEvent.EmojiCreate,
      emoji.id
    );
    const executor = entry?.executor || null;

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('😃 Эмодзи добавлено')
      .setDescription(
        `**Эмодзи:** ${emoji} (\`:${emoji.name}:\` / \`${emoji.id}\`)\n` +
        `**Анимированное:** ${emoji.animated ? 'Да' : 'Нет'}\n` +
        `**Добавил:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setThumbnail(emoji.url)
      .setTimestamp();

    await AuditLogger.sendHumanOrBotLog(emoji.guild, 'CHANNELS', executor, embed, {
      action: 'EMOJI_CREATE',
      executorId: executor?.id,
      executorTag: executor?.tag,
      targetId: emoji.id,
      targetTag: emoji.name,
      details: `Добавлено эмодзи :${emoji.name}: (${executor ? `добавил @${executor.tag}` : 'неизвестно'})`,
      metadata: { emojiId: emoji.id, emojiName: emoji.name, url: emoji.url },
    });
  });

  // Emoji Delete
  bot.on(Events.GuildEmojiDelete, async (emoji: GuildEmoji) => {
    const entry = await AuditLogger.getAuditLogEntry(
      emoji.guild,
      AuditLogEvent.EmojiDelete,
      emoji.id
    );
    const executor = entry?.executor || null;

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🗑️ Эмодзи удалено')
      .setDescription(
        `**Эмодзи:** \`:${emoji.name}:\` (\`${emoji.id}\`)\n` +
        `**Удалил:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendHumanOrBotLog(emoji.guild, 'CHANNELS', executor, embed, {
      action: 'EMOJI_DELETE',
      executorId: executor?.id,
      executorTag: executor?.tag,
      targetId: emoji.id,
      targetTag: emoji.name,
      details: `Удалено эмодзи :${emoji.name}: (${executor ? `удалил @${executor.tag}` : 'неизвестно'})`,
      metadata: { emojiId: emoji.id, emojiName: emoji.name },
    });
  });

  // Emoji Update
  bot.on(Events.GuildEmojiUpdate, async (oldEmoji: GuildEmoji, newEmoji: GuildEmoji) => {
    if (oldEmoji.name === newEmoji.name) return;

    const entry = await AuditLogger.getAuditLogEntry(
      newEmoji.guild,
      AuditLogEvent.EmojiUpdate,
      newEmoji.id
    );
    const executor = entry?.executor || null;

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('✏️ Эмодзи переименовано')
      .setDescription(
        `**Эмодзи:** ${newEmoji}\n` +
        `**Было:** \`:${oldEmoji.name}:\`\n` +
        `**Стало:** \`:${newEmoji.name}:\`\n` +
        `**Исполнитель:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setThumbnail(newEmoji.url)
      .setTimestamp();

    await AuditLogger.sendHumanOrBotLog(newEmoji.guild, 'CHANNELS', executor, embed, {
      action: 'EMOJI_UPDATE',
      executorId: executor?.id,
      executorTag: executor?.tag,
      targetId: newEmoji.id,
      targetTag: newEmoji.name,
      details: `Эмодзи переименовано: :${oldEmoji.name}: ➔ :${newEmoji.name}:`,
      metadata: { oldName: oldEmoji.name, newName: newEmoji.name },
    });
  });
}
