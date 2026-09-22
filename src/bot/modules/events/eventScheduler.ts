import { TextChannel, EmbedBuilder } from 'discord.js';
import bot from '../../client';
import prisma from '../../../database/client';
import { EventService } from './eventService';
import { AuditLogger } from '../logging/auditLogger';

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
      this.checkMessageCleanup().catch(err => {
        console.error('[EventScheduler] Error cleaning up event messages:', err);
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
          data: { 
            status: 'FINISHED',
            finishedAt: now,
          },
        });

        const finishLines: string[] = [
          `🚀 **Мероприятие официально началось!**\n`,
        ];
        if (event.voiceChannelId) finishLines.push(`> 🔊 **Голосовой канал:** <#${event.voiceChannelId}>`);
        if (event.partyCode) finishLines.push(`> 🔑 **Код группы:** \`${event.partyCode}\``);
        finishLines.push(`\nВсем участникам хорошей игры и побед! Сообщение сбора удалится через 30 минут.`);

        const finishEmbed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle(`🏁 Старт мероприятия: ${event.title}`)
          .setDescription(finishLines.join('\n'))
          .setTimestamp();

        await channel.send({ embeds: [finishEmbed] });
        await EventService.refreshAnnouncement(guild, event.id);
        this.sentMilestones.delete(event.id);

        // Audit log in #ивенты-лог
        const logEmbed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle(`🏁 Мероприятие завершено (старт): ${event.title}`)
          .setDescription(
            `Мероприятие **${event.title}** завершилось (время начала наступило).\n` +
            `Канал: <#${event.channelId}>\n` +
            `Участников: ${event.participants.length}`
          )
          .setTimestamp();
        await AuditLogger.sendLog(guild, 'EVENTS', logEmbed);

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

          // Build ping targets with exact role support
          let pings = '';
          const targetRoleId = event.targetRoleId;
          if (event.type === 'LIMITED') {
            const confirmed = event.participants.filter(p => p.status === 'CONFIRMED');
            if (confirmed.length > 0) {
              pings = confirmed.map(p => `<@${p.userId}>`).join(' ');
            } else if (targetRoleId) {
              if (targetRoleId === 'everyone') pings = '@everyone';
              else if (targetRoleId === 'here') pings = '@here';
              else if (targetRoleId !== 'none') pings = `<@&${targetRoleId}>`;
            }
          } else {
            if (targetRoleId === 'everyone') pings = '@everyone';
            else if (targetRoleId === 'here') pings = '@here';
            else if (targetRoleId === 'none') pings = '';
            else if (targetRoleId) pings = `<@&${targetRoleId}>`;
            else pings = '@here';
          }

          const isCheckInPing = matchesCheckIn;
          const reminderLines: string[] = [
            `🔔 **До ${isCheckInPing ? 'проверки явки (чек-ин)' : 'начала мероприятия'} осталось ${targetMin} мин!**\n`,
          ];

          if (event.voiceChannelId) {
            reminderLines.push(`> 🔊 **Голосовой канал:** <#${event.voiceChannelId}>`);
          }
          if (event.partyCode) {
            reminderLines.push(`> 🔑 **Код группы:** \`${event.partyCode}\``);
          }
          if (event.messageId) {
            reminderLines.push(`> 📍 [Открыть карточку сбора](https://discord.com/channels/${guild.id}/${event.channelId}/${event.messageId})`);
          }

          const reminderEmbed = new EmbedBuilder()
            .setColor(targetMin <= 3 ? 0xED4245 : (targetMin <= 5 ? 0xFEE75C : 0x5865F2))
            .setTitle(`⏰ Напоминание: ${event.title}`)
            .setDescription(reminderLines.join('\n'))
            .setFooter({ text: 'Приготовьте экипировку и занимайте места в канале' })
            .setTimestamp();

          await channel.send({
            content: pings || undefined,
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

  /**
   * Automatically delete event announcement messages 30 minutes after event finishes or is cancelled
   */
  private static async checkMessageCleanup() {
    const finishedEvents = await prisma.eventGathering.findMany({
      where: {
        status: { in: ['FINISHED', 'CANCELLED'] },
        messageDeleted: false,
        messageId: { not: null },
        channelId: { not: null },
      },
    });

    const now = new Date();

    for (const event of finishedEvents) {
      const finishTime = event.finishedAt || event.eventTime || event.updatedAt;
      const diffMinutes = (now.getTime() - finishTime.getTime()) / 60000;

      // 30 minutes past event finish
      if (diffMinutes >= 30) {
        const guild = bot.guilds.cache.get(event.guildId);
        if (guild && event.channelId && event.messageId) {
          try {
            const channel = (guild.channels.cache.get(event.channelId) ||
              await guild.channels.fetch(event.channelId).catch(() => null)) as TextChannel | null;

            if (channel && channel.isTextBased()) {
              const msg = await channel.messages.fetch(event.messageId).catch(() => null);
              if (msg) {
                await msg.delete().catch(() => null);
              }
            }

            // Log auto-deletion to #ивенты-лог
            const deleteEmbed = new EmbedBuilder()
              .setColor(0x95A5A6)
              .setTitle(`🗑️ Удалено сообщение сбора: ${event.title}`)
              .setDescription(
                `Сообщение сбора на мероприятие **«${event.title}»** было автоматически удалено спустя 30 минут после его завершения.\n` +
                `Канал: <#${event.channelId}>`
              )
              .setTimestamp();
            await AuditLogger.sendLog(guild, 'EVENTS', deleteEmbed);
          } catch (err) {
            console.error(`[EventScheduler] Error deleting message for event ${event.id}:`, err);
          }
        }

        // Mark as deleted in DB so we never check again
        await prisma.eventGathering.update({
          where: { id: event.id },
          data: {
            messageDeleted: true,
            messageId: null,
          },
        }).catch(() => null);
      }
    }
  }
}

