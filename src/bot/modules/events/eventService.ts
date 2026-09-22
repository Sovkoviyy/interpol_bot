import {
  Guild,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction,
  GuildMember,
} from 'discord.js';
import prisma from '../../../database/client';
import { AuditLogger } from '../logging/auditLogger';

export class EventService {
  /**
   * Generates the rich embed for an event gathering
   */
  public static async buildEventEmbed(eventId: string): Promise<EmbedBuilder> {
    const event = await prisma.eventGathering.findUnique({
      where: { id: eventId },
      include: {
        participants: {
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!event) throw new Error('Event not found');

    const checkInUnix = Math.floor(event.checkInTime.getTime() / 1000);
    const eventUnix = Math.floor(event.eventTime.getTime() / 1000);

    const isLimited = event.type === 'LIMITED';
    const confirmed = event.participants.filter(p => p.status === 'CONFIRMED');
    const reserve = event.participants.filter(p => p.status === 'RESERVE');

    const embed = new EmbedBuilder()
      .setColor(event.status === 'ACTIVE' ? 0x5865F2 : (event.status === 'FINISHED' ? 0x2ECC71 : 0xED4245))
      .setTitle(`⚔️  ${event.title}`);

    const descParts: string[] = [];

    if (event.description) {
      descParts.push(`> 💬 *${event.description}*\n`);
    }

    descParts.push(`⏰ **Начало:** <t:${eventUnix}:t> • <t:${eventUnix}:R>`);
    descParts.push(`📋 **Чек-ин:** <t:${checkInUnix}:t> • <t:${checkInUnix}:R>`);
    descParts.push(`👑 **Организатор:** <@${event.createdById}>`);

    if (event.voiceChannelId) {
      descParts.push(`🔊 **Голосовой канал:** <#${event.voiceChannelId}>`);
    }

    if (event.partyCode) {
      descParts.push(`🔑 **Код группы:** \`${event.partyCode}\``);
    }

    if (event.targetRoleId && event.targetRoleId !== 'none') {
      const roleText = event.targetRoleId === 'everyone'
        ? '@everyone'
        : (event.targetRoleId === 'here' ? '@here' : `<@&${event.targetRoleId}>`);
      descParts.push(`🎯 **Упоминание:** ${roleText}`);
    }

    embed.setDescription(descParts.join('\n'));

    if (isLimited) {
      const limit = event.participantLimit || 10;
      // Main roster
      let confirmedText = confirmed.length > 0 
        ? confirmed.map((p, idx) => `\`${idx + 1}.\` <@${p.userId}>`).join('\n')
        : '*Список пуст. Нажмите «Записаться» ниже.*';

      if (confirmedText.length > 1024) confirmedText = confirmedText.slice(0, 1000) + '...';

      embed.addFields({
        name: `👥 Основной состав (${confirmed.length}/${limit})`,
        value: confirmedText,
        inline: false,
      });

      // Reserve list only when there are members in reserve
      if (reserve.length > 0) {
        let reserveText = reserve
          .map((p, idx) => `\`${idx + 1}.\` <@${p.userId}>`)
          .join('\n');
        if (reserveText.length > 1024) reserveText = reserveText.slice(0, 1000) + '...';

        embed.addFields({
          name: `🪑 Резерв (${reserve.length})`,
          value: reserveText,
          inline: false,
        });
      }
    }

    let footerText = 'Сбор семьи • Нажмите кнопку ниже для записи';
    if (event.status === 'FINISHED') {
      footerText = '🏁 Мероприятие завершено • Сообщение удалится через 30 мин';
    } else if (event.status === 'CANCELLED') {
      footerText = '❌ Мероприятие отменено организатором';
    }

    embed.setFooter({ text: footerText }).setTimestamp();
    return embed;
  }

  /**
   * Action buttons for an event
   */
  public static buildEventButtons(eventId: string, isLimited: boolean, isFinished = false): ActionRowBuilder<ButtonBuilder>[] {
    if (isFinished) return [];

    const row = new ActionRowBuilder<ButtonBuilder>();

    if (isLimited) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`event_join_${eventId}`)
          .setLabel('Записаться')
          .setEmoji('✋')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`event_reserve_${eventId}`)
          .setLabel('В резерв')
          .setEmoji('🪑')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`event_leave_${eventId}`)
          .setLabel('Отказаться')
          .setEmoji('🚪')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`event_manage_${eventId}`)
          .setLabel('Управление')
          .setEmoji('⚙️')
          .setStyle(ButtonStyle.Primary)
      );
    } else {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`event_leave_${eventId}`)
          .setLabel('Не смогу')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`event_manage_${eventId}`)
          .setLabel('Завершить сбор')
          .setEmoji('🏁')
          .setStyle(ButtonStyle.Danger)
      );
    }

    return [row];
  }

  /**
   * Update announcement message in Discord
   */
  public static async refreshAnnouncement(guild: Guild, eventId: string): Promise<void> {
    try {
      const event = await prisma.eventGathering.findUnique({ where: { id: eventId } });
      if (!event || !event.channelId || !event.messageId) return;

      const channel = (guild.channels.cache.get(event.channelId) || 
        await guild.channels.fetch(event.channelId).catch(() => null)) as TextChannel | null;
      if (!channel || !channel.isTextBased()) return;

      const message = await channel.messages.fetch(event.messageId).catch(() => null);
      if (!message) return;

      const embed = await this.buildEventEmbed(eventId);
      const isFinished = event.status !== 'ACTIVE';
      const components = this.buildEventButtons(eventId, event.type === 'LIMITED', isFinished);

      await message.edit({ embeds: [embed], components });
    } catch (error) {
      console.error(`[EventService] Error updating announcement for event ${eventId}:`, error);
    }
  }

  /**
   * Handle member joining a limited event
   */
  public static async handleJoin(interaction: ButtonInteraction, eventId: string, forceReserve = false): Promise<void> {
    const event = await prisma.eventGathering.findUnique({
      where: { id: eventId },
      include: { participants: true },
    });

    if (!event) {
      await interaction.reply({ content: '❌ Мероприятие не найдено.', ephemeral: true });
      return;
    }

    if (event.status !== 'ACTIVE') {
      await interaction.reply({ content: '❌ Данный сбор уже завершен или отменен.', ephemeral: true });
      return;
    }

    const userId = interaction.user.id;
    const existing = event.participants.find(p => p.userId === userId);

    if (existing) {
      await interaction.reply({
        content: `ℹ️ Вы уже записаны в список (${existing.status === 'CONFIRMED' ? 'Основной состав' : 'Резерв'}).`,
        ephemeral: true,
      });
      return;
    }

    const confirmedCount = event.participants.filter(p => p.status === 'CONFIRMED').length;
    const limit = event.participantLimit || 999;

    let assignedStatus: 'CONFIRMED' | 'RESERVE' = 'CONFIRMED';
    if (forceReserve || confirmedCount >= limit) {
      assignedStatus = 'RESERVE';
    }

    await prisma.eventParticipant.create({
      data: {
        eventId,
        userId,
        userTag: interaction.user.tag,
        status: assignedStatus,
      },
    });

    await interaction.reply({
      content: assignedStatus === 'CONFIRMED' 
        ? `✅ Вы успешно записались в **основной состав** на мероприятие **${event.title}**!` 
        : `🪑 Основной состав заполнен (${confirmedCount}/${limit}). Вы добавлены в **резерв**. Если кто-то откажется, вы автоматически перейдете в основной состав!`,
      ephemeral: true,
    });

    await this.refreshAnnouncement(interaction.guild!, eventId);

    // Audit log in #ивенты-лог
    const joinEmbed = new EmbedBuilder()
      .setColor(assignedStatus === 'CONFIRMED' ? 0x2ECC71 : 0xFEE75C)
      .setTitle(`✋ Запись на мероприятие: ${event.title}`)
      .setDescription(
        `Участник <@${userId}> (\`${interaction.user.tag}\`) записался в **${assignedStatus === 'CONFIRMED' ? 'основной состав' : 'резерв'}**.\n` +
        `Мероприятие: **«${event.title}»**\n` +
        `Канал: <#${event.channelId}>\n` +
        `Состав: ${assignedStatus === 'CONFIRMED' ? confirmedCount + 1 : confirmedCount}/${limit}`
      )
      .setTimestamp();
    await AuditLogger.sendLog(interaction.guild!, 'EVENTS', joinEmbed);
  }

  /**
   * Handle member leaving an event (promotes next person from reserve if available)
   */
  public static async handleLeave(interaction: ButtonInteraction, eventId: string): Promise<void> {
    const event = await prisma.eventGathering.findUnique({
      where: { id: eventId },
      include: {
        participants: { orderBy: { joinedAt: 'asc' } },
      },
    });

    if (!event) {
      await interaction.reply({ content: '❌ Мероприятие не найдено.', ephemeral: true });
      return;
    }

    const userId = interaction.user.id;
    const existing = event.participants.find(p => p.userId === userId);

    if (!existing) {
      await interaction.reply({ content: 'ℹ️ Вас нет в списке участников этого мероприятия.', ephemeral: true });
      return;
    }

    const wasConfirmed = existing.status === 'CONFIRMED';

    // Remove participant
    await prisma.eventParticipant.delete({
      where: { id: existing.id },
    });

    let promotedUserTag: string | null = null;
    let promotedUserId: string | null = null;

    // If was confirmed, promote first reserve
    if (wasConfirmed) {
      const firstReserve = event.participants.find(p => p.status === 'RESERVE' && p.userId !== userId);
      if (firstReserve) {
        await prisma.eventParticipant.update({
          where: { id: firstReserve.id },
          data: { status: 'CONFIRMED' },
        });
        promotedUserId = firstReserve.userId;
        promotedUserTag = firstReserve.userTag;

        // Try to DM the promoted user
        const targetMember = await interaction.guild!.members.fetch(firstReserve.userId).catch(() => null);
        if (targetMember) {
          targetMember.send({
            content: `🔔 Место освободилось! Вы были автоматически переведены из **резерва в основной состав** на мероприятие **${event.title}**!`,
          }).catch(() => null);
        }
      }
    }

    await interaction.reply({
      content: `🚪 Вы отказались от участия в мероприятии.${promotedUserTag ? `\n⬆️ Из резерва на ваше место переведен: <@${promotedUserId}>.` : ''}`,
      ephemeral: true,
    });

    await this.refreshAnnouncement(interaction.guild!, eventId);

    // Audit log in #ивенты-лог
    const leaveEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(`🚪 Отказ от участия: ${event.title}`)
      .setDescription(
        `Участник <@${userId}> (\`${interaction.user.tag}\`) покинул список участников мероприятия **«${event.title}»**.\n` +
        (promotedUserId ? `⬆️ Из резерва в основной состав переведен: <@${promotedUserId}>.` : '')
      )
      .setTimestamp();
    await AuditLogger.sendLog(interaction.guild!, 'EVENTS', leaveEmbed);
  }

  /**
   * Prompt host management panel (kick member from roster)
   */
  public static async promptManagement(interaction: ButtonInteraction, eventId: string): Promise<void> {
    const event = await prisma.eventGathering.findUnique({
      where: { id: eventId },
      include: {
        participants: { orderBy: { joinedAt: 'asc' } },
      },
    });

    if (!event) {
      await interaction.reply({ content: '❌ Мероприятие не найдено.', ephemeral: true });
      return;
    }

    const member = interaction.member as GuildMember;
    const isOwner = event.createdById === interaction.user.id;
    const isAdmin = member.permissions.has('Administrator');

    if (!isOwner && !isAdmin) {
      await interaction.reply({
        content: '❌ Только организатор мероприятия или администратор может управлять составом.',
        ephemeral: true,
      });
      return;
    }

    if (event.type === 'UNLIMITED') {
      // Allow ending the event
      const now = new Date();
      await prisma.eventGathering.update({
        where: { id: eventId },
        data: { 
          status: 'FINISHED',
          finishedAt: now,
        },
      });
      await interaction.reply({ content: '🏁 Сбор на мероприятие завершен.', ephemeral: true });
      await this.refreshAnnouncement(interaction.guild!, eventId);

      const finishEmbed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle(`🏁 Сбор завершен: ${event.title}`)
        .setDescription(`Организатор/администратор <@${interaction.user.id}> завершил сбор на мероприятие **«${event.title}»**.`)
        .setTimestamp();
      await AuditLogger.sendLog(interaction.guild!, 'EVENTS', finishEmbed);

      return;
    }

    if (event.participants.length === 0) {
      await interaction.reply({ content: 'ℹ️ В списке участников пока никого нет.', ephemeral: true });
      return;
    }

    const options = event.participants.slice(0, 25).map(p => {
      return new StringSelectMenuOptionBuilder()
        .setLabel(`${p.status === 'CONFIRMED' ? '👥' : '🪑'} ${p.userTag || p.userId}`)
        .setDescription(`Статус: ${p.status === 'CONFIRMED' ? 'Основа' : 'Резерв'} | ID: ${p.userId}`)
        .setValue(`kick_${eventId}_${p.userId}`);
    });

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`event_admin_kick_${eventId}`)
      .setPlaceholder('Выберите участника для исключения из состава...')
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

    await interaction.reply({
      content: '⚙️ **Панель управления составом:** выберите человека ниже, чтобы исключить его из состава (из резерва автоматически подтянется замена).',
      components: [row],
      ephemeral: true,
    });
  }

  /**
   * Handle admin kicking member via select menu
   */
  public static async handleAdminKick(interaction: StringSelectMenuInteraction): Promise<void> {
    const value = interaction.values[0]; // e.g. "kick_eventId_userId"
    const [, eventId, targetUserId] = value.split('_');

    const event = await prisma.eventGathering.findUnique({
      where: { id: eventId },
      include: { participants: { orderBy: { joinedAt: 'asc' } } },
    });

    if (!event) {
      await interaction.reply({ content: '❌ Мероприятие не найдено.', ephemeral: true });
      return;
    }

    const targetParticipant = event.participants.find(p => p.userId === targetUserId);
    if (!targetParticipant) {
      await interaction.reply({ content: '❌ Участник уже не в списке.', ephemeral: true });
      return;
    }

    const wasConfirmed = targetParticipant.status === 'CONFIRMED';
    await prisma.eventParticipant.delete({ where: { id: targetParticipant.id } });

    let promotedUserId: string | null = null;
    if (wasConfirmed) {
      const firstReserve = event.participants.find(p => p.status === 'RESERVE' && p.userId !== targetUserId);
      if (firstReserve) {
        await prisma.eventParticipant.update({
          where: { id: firstReserve.id },
          data: { status: 'CONFIRMED' },
        });
        promotedUserId = firstReserve.userId;

        const targetMember = await interaction.guild!.members.fetch(firstReserve.userId).catch(() => null);
        if (targetMember) {
          targetMember.send({
            content: `🔔 Вы переведены из резерва в основной состав на мероприятие **${event.title}**!`,
          }).catch(() => null);
        }
      }
    }

    await interaction.reply({
      content: `✅ <@${targetUserId}> был исключен из состава.${promotedUserId ? `\n⬆️ Из резерва добавлен: <@${promotedUserId}>.` : ''}`,
      ephemeral: true,
    });

    await this.refreshAnnouncement(interaction.guild!, eventId);

    // Audit log in #ивенты-лог
    const kickEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(`❌ Исключение с мероприятия: ${event.title}`)
      .setDescription(
        `Администратор/организатор <@${interaction.user.id}> исключил участника <@${targetUserId}> из мероприятия **«${event.title}»**.\n` +
        (promotedUserId ? `⬆️ Из резерва в основной состав переведен: <@${promotedUserId}>.` : '')
      )
      .setTimestamp();
    await AuditLogger.sendLog(interaction.guild!, 'EVENTS', kickEmbed);
  }
}
