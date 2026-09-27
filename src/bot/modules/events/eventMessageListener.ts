import { Events, Message } from 'discord.js';
import bot from '../../client';
import prisma from '../../../database/client';
import { EventService } from './eventService';

export function registerEventMessageListener() {
  bot.on(Events.MessageCreate, async (message: Message) => {
    try {
      if (message.author?.bot || !message.guild) return;

      const trimmed = message.content.trim().toLowerCase();
      
      const isReservePlus = trimmed === '+резерв' || trimmed.startsWith('+резерв ') || trimmed === '+ запас';
      const isPlus = trimmed === '+' || trimmed.startsWith('+ ') || trimmed === '+капт' || trimmed === '+взз' || trimmed === '+мп';
      const isMinus = trimmed === '-' || trimmed.startsWith('- ') || trimmed === '-капт' || trimmed === '-взз' || trimmed === '-мп';

      if (!isPlus && !isMinus && !isReservePlus) return;

      // Check if there is an active event in this channel
      const activeEvent = await prisma.eventGathering.findFirst({
        where: {
          guildId: message.guild.id,
          channelId: message.channelId,
          status: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!activeEvent) return;

      if (isReservePlus) {
        await EventService.handleMessageJoin(message, activeEvent.id, true);
      } else if (isPlus) {
        await EventService.handleMessageJoin(message, activeEvent.id, false);
      } else if (isMinus) {
        await EventService.handleMessageLeave(message, activeEvent.id);
      }
    } catch (err) {
      console.error('[EventMessageListener] Error handling event message:', err);
    }
  });
}
