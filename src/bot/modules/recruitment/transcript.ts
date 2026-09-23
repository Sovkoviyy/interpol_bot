import { TextChannel, Collection, Message, AttachmentBuilder } from 'discord.js';

export class TranscriptService {
  /**
   * Generates a clean text/html transcript of a channel and returns an AttachmentBuilder
   */
  public static async generateTranscript(channel: TextChannel): Promise<AttachmentBuilder> {
    let allMessages: Message[] = [];
    let lastId: string | undefined;

    if (!channel?.messages || typeof channel.messages.fetch !== 'function') {
      const buffer = Buffer.from(`========================================================\nТРАНСКРИПТ КАНАЛА: #${channel?.name || 'unknown'}\nНет сообщений или канал недоступен.\n========================================================\n`, 'utf-8');
      return new AttachmentBuilder(buffer, { name: `transcript-${channel?.name || 'channel'}-${Date.now()}.txt` });
    }

    // Fetch up to 500 messages
    for (let i = 0; i < 5; i++) {
      const options: { limit: number; before?: string } = { limit: 100 };
      if (lastId) options.before = lastId;

      const messages: Collection<string, Message> = await channel.messages.fetch(options);
      if (messages.size === 0) break;

      allMessages.push(...messages.values());
      lastId = messages.last()?.id;
      if (messages.size < 100) break;
    }

    allMessages.reverse();

    let transcript = `========================================================\n`;
    transcript += `ТРАНСКРИПТ КАНАЛА: #${channel?.name || 'unknown'} (${channel?.id || 'unknown'})\n`;
    transcript += `ДАТА СОХРАНЕНИЯ: ${new Date().toLocaleString('ru-RU')}\n`;
    transcript += `СЕРВЕР: ${channel?.guild?.name || 'Discord'}\n`;
    transcript += `========================================================\n\n`;

    for (const msg of allMessages) {
      const time = msg.createdAt.toLocaleString('ru-RU');
      const author = `${msg.author.tag} (${msg.author.id})`;
      const content = msg.content || (msg.embeds.length > 0 ? '[Встроенное сообщение / Embed]' : '[Вложение]');
      
      transcript += `[${time}] ${author}:\n${content}\n`;
      if (msg.attachments.size > 0) {
        transcript += `Вложения: ${msg.attachments.map(a => a.url).join(', ')}\n`;
      }
      transcript += `--------------------------------------------------------\n`;
    }

    const buffer = Buffer.from(transcript, 'utf-8');
    return new AttachmentBuilder(buffer, { name: `transcript-${channel.name}-${Date.now()}.txt` });
  }
}
