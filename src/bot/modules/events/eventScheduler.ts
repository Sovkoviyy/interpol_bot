import { TextChannel, EmbedBuilder } from 'discord.js';
import bot from '../../client';
import prisma from '../../../database/client';
import { EventService } from './eventService';

export class EventScheduler {
  private static timer: NodeJS.Timeout | null = null;
  private static sentMilestones: Map<string, Set<number>> = new Map();

  public static start() {
    if (this.timer) return;
    console.log('⏰ [EventScheduler] Starting event reminder scheduler...');
    
    // Check every 25 seconds
    this.timer = setInterval(() => {
      this.checkActiveEvents().catch(err => {
        console.error('[EventScheduler] Error checking events:', err);
      });
    }, 25000);
  }

  public static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private static async checkActiveEvents() {
    const activeEvents = await prisma.eventGathering.findMany({
      where: { status: 'ACTIVE' },
      include: { participants: true },
    });

    const now = new Date();

    for (const event of activeEvents) {
      const guild = bot.guilds.cache.get(event.guildId);
      if (!guild || !event.channelId) continue;

      const channel = guild.channels.cache.get(event.channelId) as TextChannel | undefined;
      if (!channel || !channel.isTextBased()) continue;

      // Check if event has ended
      if (now >= event.eventTime) {
        await prisma.eventGathering.update({
          where: { id: event.id },
          data: { status: 'FINISHED' },
        });

        const finishEmbed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle(`🏁 Мероприятие началось: ${event.title}`)
          .setDescription(
            `Сбор завершен! Мероприятие официально началось.\n` +
            `Код группы: \`${event.partyCode || 'Не указан'}\`\n` +
            (event.voiceChannelId ? `Голосовой канал: <#${event.voiceChannelId}>\n` : '') +
            `Всем участникам хорошей игры!`
          )
          .setTimestamp();

        await channel.send({ embeds: [finishEmbed] });
        await EventService.refreshAnnouncement(guild, event.id);
        this.sentMilestones.delete(event.id);
        continue;
      }

      // Check milestone pings
      let intervals: number[] = [15, 10, 5, 3, 1];
      try {
        intervals = JSON.parse(event.pingIntervalsJson || '[15, 10, 5, 3, 1]');
      } catch {
        intervals = [15, 10, 5, 3, 1];
      }

      // Minutes until event start
      const diffMs = event.eventTime.getTime() - now.getTime();
      const diffMinutes = Math.round(diffMs / 60000);

      // Check check-in difference
      const checkInDiffMs = event.checkInTime.getTime() - now.getTime();
      const checkInDiffMinutes = Math.round(checkInDiffMs / 60000);

      if (!this.sentMilestones.has(event.id)) {
        this.sentMilestones.set(event.id, new Set());
      }
      const sent = this.sentMilestones.get(event.id)!;

      // Determine if a milestone was reached
      for (const targetMin of intervals) {
        if (sent.has(targetMin)) continue;

        // Trigger if remaining time is <= targetMin and > targetMin - 1.5
        const matchesEventStart = diffMinutes <= targetMin && diffMinutes >= targetMin - 1;
        const matchesCheckIn = checkInDiffMinutes <= targetMin && checkInDiffMinutes >= targetMin - 1 && checkInDiffMinutes > 0;

        if (matchesEventStart || matchesCheckIn) {
          sent.add(targetMin);

          // Build ping targets
          let pings = '';
          if (event.type === 'LIMITED') {
            const confirmed = event.participants.filter(p => p.status === 'CONFIRMED');
            if (confirmed.length > 0) {
              pings = confirmed.map(p => `<@${p.userId}>`).join(' ');
            } else if (event.targetRoleId) {
              pings = `<@&${event.targetRoleId}>`;
            }
          } else {
            pings = event.targetRoleId ? `<@&${event.targetRoleId}>` : '@here';
          }

          const isCheckInPing = matchesCheckIn;
          const timeText = isCheckInPing 
            ? `до **проверки явки (чек-ин)** осталось **${targetMin} мин.**!` 
            : `до **начала мероприятия** осталось **${targetMin} мин.**!`;

          const reminderEmbed = new EmbedBuilder()
            .setColor(targetMin <= 3 ? 0xED4245 : 0xFEE75C)
            .setTitle(`⏰ Внимание! Сбор на ${event.title}`)
            .setDescription(
              `${timeText}\n\n` +
              (event.voiceChannelId ? `🔊 Заходите в голосовой канал: <#${event.voiceChannelId}>\n` : '') +
              (event.partyCode ? `🔑 Код группы: \`${event.partyCode}\`\n` : '') +
              `📌 Чек-ин: <t:${Math.floor(event.checkInTime.getTime() / 1000)}:t>\n` +
              `🚀 Старт: <t:${Math.floor(event.eventTime.getTime() / 1000)}:t>`
            )
            .setFooter({ text: `Автоматическое напоминание бота` })
            .setTimestamp();

          await channel.send({
            content: pings,
            embeds: [reminderEmbed],
          });

          await prisma.eventGathering.update({
            where: { id: event.id },
            data: { lastPingSentAt: now },
          });

          break; // Fire one milestone per loop
        }
      }
    }
  }
}
