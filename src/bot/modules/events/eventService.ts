import {
  MessageFlags,
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
  Message,
} from 'discord.js';
import prisma from '../../../database/client';
import { AuditLogger } from '../logging/auditLogger';
import bot from '../../client';
import { THEME, createThemedEmbed } from '../../utils/theme';
import { BotMessageManager } from '../../utils/botMessageManager';

export interface RoleHierarchyItem {
  roleId: string;
  roleName?: string;
  priority: number;
}

export class EventService {
  private static eventLocks: Map<string, Promise<any>> = new Map();
  private static refreshTimers: Map<string, NodeJS.Timeout> = new Map();

  private static async runWithEventLock<T>(eventId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.eventLocks.get(eventId) || Promise.resolve();
    let release: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.eventLocks.set(eventId, previous.then(() => current, () => current));

    try {
      await previous;
      return await fn();
    } finally {
      release!();
      if (this.eventLocks.get(eventId) === current) {
        this.eventLocks.delete(eventId);
      }
    }
  }

  public static queueRefreshAnnouncement(guild: Guild, eventId: string): void {
    const existing = this.refreshTimers.get(eventId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.refreshTimers.delete(eventId);
      this.refreshAnnouncement(guild, eventId).catch(console.error);
    }, 400);
    this.refreshTimers.set(eventId, timer);
  }

  private static async resolveGuild(interaction: { guild?: Guild | null; guildId?: string | null }): Promise<Guild | null> {
    if (interaction.guild) return interaction.guild;
    const guildId = interaction.guildId;
    if (!guildId) return null;
    return bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
  }

  /**
   * Calculates a user's priority score based on configured role hierarchy and profile rank.
   */
  public static async getUserPriorityScore(
    guild: Guild | null,
    guildId: string,
    userId: string,
    cachedGuildConfig?: any,
    cachedProfile?: any
  ): Promise<{ score: number; rolePriority: number; rank: number; matchedRoleName?: string }> {
    let score = 0;
    let rolePriority = 0;
    let matchedRoleName: string | undefined = undefined;

    const guildConfig = cachedGuildConfig !== undefined
      ? cachedGuildConfig
      : await prisma.guildConfig.findUnique({ where: { guildId } });

    let roleHierarchy: RoleHierarchyItem[] = [];
    try {
      if (guildConfig?.eventRoleHierarchyJson) {
        roleHierarchy = JSON.parse(guildConfig.eventRoleHierarchyJson);
      }
    } catch {}

    const member = guild ? (guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null)) : null;

    if (member) {
      // 1. Check roles against configured hierarchy
      for (const item of roleHierarchy) {
        if (member.roles.cache.has(item.roleId)) {
          if (item.priority > rolePriority) {
            rolePriority = item.priority;
            matchedRoleName = item.roleName || member.roles.cache.get(item.roleId)?.name;
          }
        }
      }

      // Backward compatibility with single eventPriorityRoleId if hierarchy didn't match
      if (rolePriority === 0 && guildConfig?.eventPriorityRoleId && member.roles.cache.has(guildConfig.eventPriorityRoleId)) {
        rolePriority = 100;
        matchedRoleName = member.roles.cache.get(guildConfig.eventPriorityRoleId)?.name || 'Приоритетная роль';
      }
    }

    score += rolePriority * 100;

    // 2. Profile IC rank bonus
    let rank = 0;
    const profile = cachedProfile !== undefined
      ? cachedProfile
      : await prisma.userProfile.findUnique({
          where: { guildId_userId: { guildId, userId } },
        });
    if (profile?.rank) {
      rank = profile.rank;
      score += rank * 10;
    }

    return { score, rolePriority, rank, matchedRoleName };
  }

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

    const eventUnix = Math.floor(event.eventTime.getTime() / 1000);

    const limit = event.participantLimit || 35;
    const confirmed = event.participants.filter(p => p.status === 'CONFIRMED');
    const reserve = event.participants.filter(p => p.status === 'RESERVE');

    let roleMention = '';
    if (event.targetRoleId && event.targetRoleId !== 'none') {
      if (event.targetRoleId === 'everyone') roleMention = '@everyone';
      else if (event.targetRoleId === 'here') roleMention = '@here';
      else roleMention = `<@&${event.targetRoleId}>`;
    }

    const voiceDisplay = event.voiceChannelId ? `<#${event.voiceChannelId}>` : 'Capt Voice';
    const mapDisplay = event.mapName || 'Не выбрана';

    let confirmedList = 'Пусто';
    if (confirmed.length > 0) {
      confirmedList = confirmed.map((p, idx) => `${idx + 1}. <@${p.userId}>`).join('\n');
    }

    let reserveList = 'Пусто';
    if (reserve.length > 0) {
      reserveList = reserve.map((p, idx) => `${idx + 1}. <@${p.userId}>`).join('\n');
    }

    const separator = '────────────────────────────────────────';

    let renderedHeader = '';
    let baseEmbed: EmbedBuilder;
    try {
      const guild = bot.guilds.cache.get(event.guildId) || await bot.guilds.fetch(event.guildId).catch(() => null);
      const rendered = await BotMessageManager.renderMessage(event.guildId, 'event_announcement', {
        eventTitle: event.title,
        eventType: (event as any).type || 'LIMITED',
        mapName: mapDisplay,
        eventTime: `<t:${eventUnix}:t>`,
        checkInTime: `<t:${eventUnix - 900}:t>`,
        voiceChannel: voiceDisplay,
        partyCode: event.partyCode || 'Не указан',
        role: roleMention || 'Состав',
        limit: String(limit),
        author: event.createdByTag || 'Организатор',
        guild: guild?.name || 'INTERPOL',
      });
      baseEmbed = EmbedBuilder.from(rendered.embed);
      renderedHeader = rendered.embed.data.description || '';
    } catch {
      baseEmbed = new EmbedBuilder().setColor(THEME.COLORS.PRIMARY);
    }

    const descParts: string[] = [];
    if (renderedHeader) {
      descParts.push(renderedHeader);
    } else {
      descParts.push(
        `### 🎯 Сбор на ${event.title.toUpperCase()}${roleMention ? ` ${roleMention}` : ''}`,
        `**Время:** <t:${eventUnix}:F> (<t:${eventUnix}:R>)`,
        `**Войс:** 🔊 ┠ ${voiceDisplay}`,
        `**Карта:** ${mapDisplay}`
      );
      if (event.partyCode) descParts.push(`**Код группы:** \`${event.partyCode}\``);
      if (event.description) descParts.push(`**Инфо:** *${event.description}*`);
    }

    descParts.push(
      '',
      separator,
      `✅ **Основной состав (${confirmed.length}/${limit})**`,
      confirmedList,
      '',
      separator,
      `🪑 **Резерв (${reserve.length})**`,
      reserveList
    );

    const embed = baseEmbed
      .setDescription(descParts.join('\n'));

    if (event.status === 'FINISHED') {
      embed.setColor(THEME.COLORS.SUCCESS);
      embed.setFooter({ text: '🏁 Мероприятие завершено • Сообщение удалится через 30 мин' });
    } else if (event.status === 'CANCELLED') {
      embed.setColor(THEME.COLORS.DANGER);
      embed.setFooter({ text: '❌ Мероприятие отменено организатором' });
    } else if (!embed.data.footer) {
      embed.setFooter({ text: '💡 Оставляйте «+» в чате или нажимайте кнопки ниже • Учитывается иерархия ролей' });
    }

    return embed;
  }

  /**
   * Action buttons for an event
   */
  public static buildEventButtons(eventId: string, isLimited: boolean = true, isFinished = false): ActionRowBuilder<ButtonBuilder>[] {
    if (isFinished) return [];

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`event_join_${eventId}`)
        .setLabel('➕ Записаться')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`event_reserve_${eventId}`)
        .setLabel('🪑 В резерв')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`event_leave_${eventId}`)
        .setLabel('➖ Отказаться')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`event_manage_${eventId}`)
        .setLabel('⚙️ Управление')
        .setStyle(ButtonStyle.Primary)
    );

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
   * Handle member joining a limited event via Discord button
   */
  /**
   * Unified core method to handle roster join logic for both buttons and text chat '+'
   */
  public static async executeJoin(params: {
    eventId: string;
    userId: string;
    userTag: string;
    serverNick: string;
    guild: Guild | null;
    forceReserve?: boolean;
    source: 'BUTTON' | 'MESSAGE';
  }): Promise<{
    success: boolean;
    alreadyJoined?: boolean;
    existingStatus?: string;
    assignedStatus: 'CONFIRMED' | 'RESERVE';
    eventTitle: string;
    matchedRoleName?: string;
    demotedUserTag?: string | null;
    confirmedCount: number;
    limit: number;
    channelId?: string;
    errorMessage?: string;
  }> {
    const event = await prisma.eventGathering.findUnique({
      where: { id: params.eventId },
      include: { participants: true },
    });

    if (!event) return { success: false, assignedStatus: 'RESERVE', eventTitle: '', confirmedCount: 0, limit: 0, errorMessage: 'Мероприятие не найдено.' };
    if (event.status !== 'ACTIVE') return { success: false, assignedStatus: 'RESERVE', eventTitle: event.title, confirmedCount: 0, limit: 0, errorMessage: 'Данный сбор уже завершен или отменен.' };

    const existing = event.participants.find(p => p.userId === params.userId);
    if (existing) {
      return {
        success: false,
        alreadyJoined: true,
        existingStatus: existing.status,
        assignedStatus: existing.status as any,
        eventTitle: event.title,
        confirmedCount: event.participants.filter(p => p.status === 'CONFIRMED').length,
        limit: event.participantLimit || 10,
      };
    }

    const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId: event.guildId } });
    const { score: myScore, matchedRoleName } = await this.getUserPriorityScore(params.guild, event.guildId, params.userId, guildConfig);
    const confirmedParticipants = event.participants.filter(p => p.status === 'CONFIRMED');
    const limit = event.participantLimit || 10;

    let assignedStatus: 'CONFIRMED' | 'RESERVE' = 'CONFIRMED';
    let demotedUserTag: string | null = null;

    if (params.forceReserve) {
      assignedStatus = 'RESERVE';
    } else if (confirmedParticipants.length < limit) {
      assignedStatus = 'CONFIRMED';
    } else {
      // Main roster is full. Batch fetch profiles for all confirmed participants to avoid N+1
      const confirmedUserIds = confirmedParticipants.map(cp => cp.userId);
      const profiles = await prisma.userProfile.findMany({
        where: { guildId: event.guildId, userId: { in: confirmedUserIds } },
      });
      const profileMap = new Map(profiles.map(p => [p.userId, p]));

      let lowestParticipant: any = null;
      let lowestScore = 9999999;

      for (const cp of confirmedParticipants) {
        const { score } = await this.getUserPriorityScore(params.guild, event.guildId, cp.userId, guildConfig, profileMap.get(cp.userId));
        if (score < lowestScore) {
          lowestScore = score;
          lowestParticipant = cp;
        }
      }

      if (lowestParticipant && myScore > lowestScore) {
        await prisma.eventParticipant.update({
          where: { id: lowestParticipant.id },
          data: { status: 'RESERVE' },
        });
        demotedUserTag = lowestParticipant.userTag;

        if (params.guild) {
          const demotedMember = await params.guild.members.fetch(lowestParticipant.userId).catch(() => null);
          if (demotedMember) {
            demotedMember.send({
              content: `⚠️ Место в основном составе на мероприятие **${event.title}** занял участник с более высоким приоритетом ролей в семье. Вы переведены в **резерв**.`,
            }).catch(() => null);
          }
        }
        assignedStatus = 'CONFIRMED';
      } else {
        assignedStatus = 'RESERVE';
      }
    }

    await prisma.eventParticipant.upsert({
      where: { eventId_userId: { eventId: params.eventId, userId: params.userId } },
      create: {
        eventId: params.eventId,
        userId: params.userId,
        userTag: params.serverNick,
        status: assignedStatus,
      },
      update: {
        status: assignedStatus,
        userTag: params.serverNick,
      },
    });

    if (params.guild) {
      this.queueRefreshAnnouncement(params.guild, params.eventId);

      const actionTitle = params.source === 'MESSAGE'
        ? `✋ Плюс на мероприятие: ${event.title}`
        : `✋ Запись на мероприятие: ${event.title}`;

      const joinEmbed = new EmbedBuilder()
        .setColor(assignedStatus === 'CONFIRMED' ? 0x2ECC71 : 0xFEE75C)
        .setTitle(actionTitle)
        .setDescription(
          `Участник <@${params.userId}> (\`${params.userTag}\`) ${params.source === 'MESSAGE' ? 'отправил «+» в чат и ' : ''}записался в **${assignedStatus === 'CONFIRMED' ? 'основной состав' : 'резерв'}**.\n` +
          `Мероприятие: **«${event.title}»**\n` +
          `Канал: <#${event.channelId}>\n` +
          (matchedRoleName ? `Роль: \`${matchedRoleName}\`\n` : '') +
          (demotedUserTag ? `⚡ По приоритету в резерв перемещен: \`${demotedUserTag}\`\n` : '') +
          `Состав: ${assignedStatus === 'CONFIRMED' ? Math.min(limit, confirmedParticipants.length + 1) : confirmedParticipants.length}/${limit}`
        )
        .setTimestamp();
      await AuditLogger.sendLog(params.guild, 'EVENTS', joinEmbed);
    }

    return {
      success: true,
      assignedStatus,
      eventTitle: event.title,
      matchedRoleName,
      demotedUserTag,
      confirmedCount: confirmedParticipants.length,
      limit,
      channelId: event.channelId || undefined,
    };
  }

  /**
   * Unified core method to handle roster leave logic for both buttons and text chat '-'
   */
  public static async executeLeave(params: {
    eventId: string;
    userId: string;
    userTag: string;
    guild: Guild | null;
    source: 'BUTTON' | 'MESSAGE';
  }): Promise<{
    success: boolean;
    notParticipant?: boolean;
    eventTitle: string;
    promotedUserId?: string | null;
    promotedUserTag?: string | null;
    errorMessage?: string;
  }> {
    const event = await prisma.eventGathering.findUnique({
      where: { id: params.eventId },
      include: {
        participants: { orderBy: { joinedAt: 'asc' } },
      },
    });

    if (!event) return { success: false, eventTitle: '', errorMessage: 'Мероприятие не найдено.' };
    if (event.status !== 'ACTIVE') return { success: false, eventTitle: event.title, errorMessage: 'Данный сбор уже завершен или отменен.' };

    const existing = event.participants.find(p => p.userId === params.userId);
    if (!existing) {
      return { success: false, notParticipant: true, eventTitle: event.title };
    }

    const wasConfirmed = existing.status === 'CONFIRMED';
    await prisma.eventParticipant.delete({ where: { id: existing.id } });

    let promotedUserId: string | null = null;
    let promotedUserTag: string | null = null;

    if (wasConfirmed) {
      const reserveParticipants = event.participants.filter(p => p.status === 'RESERVE' && p.userId !== params.userId);
      if (reserveParticipants.length > 0) {
        const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId: event.guildId } });

        // Batch fetch profiles to eliminate N+1
        const reserveUserIds = reserveParticipants.map(rp => rp.userId);
        const profiles = await prisma.userProfile.findMany({
          where: { guildId: event.guildId, userId: { in: reserveUserIds } },
        });
        const profileMap = new Map(profiles.map(p => [p.userId, p]));

        let bestReserve = reserveParticipants[0];
        let bestScore = -1;

        for (const rp of reserveParticipants) {
          const { score } = await this.getUserPriorityScore(params.guild, event.guildId, rp.userId, guildConfig, profileMap.get(rp.userId));
          if (score > bestScore) {
            bestScore = score;
            bestReserve = rp;
          }
        }

        await prisma.eventParticipant.update({
          where: { id: bestReserve.id },
          data: { status: 'CONFIRMED' },
        });
        promotedUserId = bestReserve.userId;
        promotedUserTag = bestReserve.userTag;

        if (params.guild) {
          BotMessageManager.sendDM(event.guildId, bestReserve.userId, 'event_dm_promoted', {
            user: `<@${bestReserve.userId}>`,
            username: promotedUserTag || bestReserve.userId,
            eventTitle: event.title,
            voiceChannel: event.voiceChannelId ? `<#${event.voiceChannelId}>` : '',
            partyCode: event.partyCode || '',
            guild: params.guild.name,
          }).catch(() => null);
        }
      }
    }

    if (params.guild) {
      this.queueRefreshAnnouncement(params.guild, params.eventId);

      const actionTitle = params.source === 'MESSAGE'
        ? `🚪 Отказ от участия (минус в чат): ${event.title}`
        : `🚪 Отказ от участия: ${event.title}`;

      const leaveEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(actionTitle)
        .setDescription(
          `Участник <@${params.userId}> (\`${params.userTag}\`) покинул список участников мероприятия **«${event.title}»**.\n` +
          (promotedUserId ? `⬆️ Из резерва в основной состав переведен: <@${promotedUserId}>.` : '')
        )
        .setTimestamp();
      await AuditLogger.sendLog(params.guild, 'EVENTS', leaveEmbed);
    }

    return {
      success: true,
      eventTitle: event.title,
      promotedUserId,
      promotedUserTag,
    };
  }

  /**
   * Handle member joining a limited event via Discord button
   */
  public static async handleJoin(interaction: ButtonInteraction, eventId: string, forceReserve = false): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    const replyEphemeral = async (content: string) => {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content }).catch(() => null);
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
      }
    };

    await this.runWithEventLock(eventId, async () => {
      try {
        const guild = await this.resolveGuild(interaction);
        const member = (interaction.member as GuildMember) || (guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null);
        const serverNick = member?.nickname || member?.displayName || interaction.user.displayName || interaction.user.username;

        const result = await this.executeJoin({
          eventId,
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          serverNick,
          guild,
          forceReserve,
          source: 'BUTTON',
        });

        if (!result.success) {
          if (result.alreadyJoined) {
            await replyEphemeral(`ℹ️ Вы уже записаны в список (${result.existingStatus === 'CONFIRMED' ? 'Основной состав' : 'Резерв'}).`);
          } else {
            await replyEphemeral(`❌ ${result.errorMessage || 'Ошибка записи.'}`);
          }
          return;
        }

        const roleInfo = result.matchedRoleName ? ` (роль: **${result.matchedRoleName}**)` : '';
        await replyEphemeral(
          result.assignedStatus === 'CONFIRMED'
            ? `✅ Вы успешно записались в **основной состав** на **${result.eventTitle}**!${roleInfo}${result.demotedUserTag ? ` (по приоритету вытеснив @${result.demotedUserTag} в резерв)` : ''}`
            : `🪑 Основной состав заполнен (${result.confirmedCount}/${result.limit}). Вы добавлены в **резерв**${roleInfo}. При освобождении места приоритетные участники переводятся в основу!`
        );
      } catch (err: any) {
        console.error(`[EventService] Error in handleJoin for user ${interaction.user.id}, event ${eventId}:`, err);
        await replyEphemeral('❌ Не удалось обработать запись на мероприятие. Попробуйте еще раз.').catch(() => null);
      }
    });
  }

  /**
   * Handle member leaving an event via button
   */
  public static async handleLeave(interaction: ButtonInteraction, eventId: string): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
    }

    const replyEphemeral = async (content: string) => {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content }).catch(() => null);
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => null);
      }
    };

    await this.runWithEventLock(eventId, async () => {
      try {
        const guild = await this.resolveGuild(interaction);
        const result = await this.executeLeave({
          eventId,
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          guild,
          source: 'BUTTON',
        });

        if (!result.success) {
          if (result.notParticipant) {
            await replyEphemeral('ℹ️ Вас нет в списке участников этого мероприятия.');
          } else {
            await replyEphemeral(`❌ ${result.errorMessage || 'Ошибка при выходе.'}`);
          }
          return;
        }

        await replyEphemeral(`🚪 Вы отказались от участия в мероприятии.${result.promotedUserTag ? `\n⬆️ Из резерва на ваше место переведен: <@${result.promotedUserId}>.` : ''}`);
      } catch (err: any) {
        console.error(`[EventService] Error in handleLeave for user ${interaction.user.id}, event ${eventId}:`, err);
        await replyEphemeral('❌ Не удалось обработать отказ от участия. Попробуйте еще раз.').catch(() => null);
      }
    });
  }

  /**
   * Handle text message "+" in gathering channel
   */
  public static async handleMessageJoin(message: Message, eventId: string, forceReserve = false): Promise<void> {
    await this.runWithEventLock(eventId, async () => {
      try {
        const guild = message.guild;
        const member = message.member || (guild ? await guild.members.fetch(message.author.id).catch(() => null) : null);
        const serverNick = member?.nickname || member?.displayName || message.author.displayName || message.author.username;

        const result = await this.executeJoin({
          eventId,
          userId: message.author.id,
          userTag: message.author.tag,
          serverNick,
          guild,
          forceReserve,
          source: 'MESSAGE',
        });

        if (!result.success) {
          if (result.alreadyJoined) {
            await message.react('ℹ️').catch(() => null);
          }
          return;
        }

        await message.react(result.assignedStatus === 'CONFIRMED' ? '✅' : '🪑').catch(() => null);

        const replyText = result.assignedStatus === 'CONFIRMED'
          ? `✅ <@${message.author.id}> записан в **основной состав** на **${result.eventTitle}**!${result.matchedRoleName ? ` (${result.matchedRoleName})` : ''}${result.demotedUserTag ? ` (вытеснил @${result.demotedUserTag} в резерв)` : ''}`
          : `🪑 <@${message.author.id}> мест в основе нет (${result.confirmedCount}/${result.limit}), вы добавлены в **резерв** на **${result.eventTitle}**!`;

        const rep = await message.reply({ content: replyText }).catch(() => null);
        if (rep) {
          setTimeout(() => rep.delete().catch(() => null), 6000);
        }
      } catch (err) {
        console.error(`[EventService] Error in handleMessageJoin for event ${eventId}:`, err);
      }
    });
  }

  /**
   * Handle text message "-" in gathering channel
   */
  public static async handleMessageLeave(message: Message, eventId: string): Promise<void> {
    await this.runWithEventLock(eventId, async () => {
      try {
        const result = await this.executeLeave({
          eventId,
          userId: message.author.id,
          userTag: message.author.tag,
          guild: message.guild,
          source: 'MESSAGE',
        });

        if (!result.success) {
          if (result.notParticipant) {
            await message.react('❌').catch(() => null);
          }
          return;
        }

        await message.react('🚪').catch(() => null);

        const rep = await message.reply({
          content: `🚪 <@${message.author.id}> отказался от участия в **${result.eventTitle}**.${result.promotedUserId ? `\n⬆️ Из резерва в основу переведён: <@${result.promotedUserId}>.` : ''}`,
        }).catch(() => null);
        if (rep) {
          setTimeout(() => rep.delete().catch(() => null), 6000);
        }
      } catch (err) {
        console.error(`[EventService] Error in handleMessageLeave for event ${eventId}:`, err);
      }
    });
  }

  /**
   * Swap two participants between CONFIRMED and RESERVE
   */
  public static async swapParticipants(
    guildId: string,
    eventId: string,
    userId1: string,
    userId2: string,
    operatorId?: string
  ): Promise<{ success: boolean; user1: any; user2: any }> {
    const event = await prisma.eventGathering.findUnique({
      where: { id: eventId },
      include: { participants: true },
    });
    if (!event) throw new Error('Мероприятие не найдено');

    const p1 = event.participants.find(p => p.userId === userId1);
    const p2 = event.participants.find(p => p.userId === userId2);
    if (!p1 || !p2) throw new Error('Один или оба участника не найдены в списке');

    if (p1.status === p2.status) {
      return { success: true, user1: p1, user2: p2 };
    }

    const newStatus1 = p2.status;
    const newStatus2 = p1.status;

    const [updated1, updated2] = await prisma.$transaction([
      prisma.eventParticipant.update({
        where: { id: p1.id },
        data: { status: newStatus1 },
      }),
      prisma.eventParticipant.update({
        where: { id: p2.id },
        data: { status: newStatus2 },
      }),
    ]);

    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    if (guild) {
      await this.refreshAnnouncement(guild, eventId);

      const mem1 = await guild.members.fetch(userId1).catch(() => null);
      if (mem1) {
        mem1.send({
          content: `🔄 Организатор перевёл вас в **${newStatus1 === 'CONFIRMED' ? 'основной состав' : 'резерв'}** на мероприятии **${event.title}**.`,
        }).catch(() => null);
      }
      const mem2 = await guild.members.fetch(userId2).catch(() => null);
      if (mem2) {
        mem2.send({
          content: `🔄 Организатор перевёл вас в **${newStatus2 === 'CONFIRMED' ? 'основной состав' : 'резерв'}** на мероприятии **${event.title}**.`,
        }).catch(() => null);
      }

      const swapEmbed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`🔄 Обмен местами участников: ${event.title}`)
        .setDescription(
          `Организатор ${operatorId ? `<@${operatorId}>` : 'Панель'} поменял местами участников:\n` +
          `• <@${userId1}> (${p1.userTag || userId1}) ➔ **${newStatus1 === 'CONFIRMED' ? 'Основной состав' : 'Резерв'}**\n` +
          `• <@${userId2}> (${p2.userTag || userId2}) ➔ **${newStatus2 === 'CONFIRMED' ? 'Основной состав' : 'Резерв'}**\n` +
          `Мероприятие: **«${event.title}»**`
        )
        .setTimestamp();
      await AuditLogger.sendLog(guild, 'EVENTS', swapEmbed);
    }

    return { success: true, user1: updated1, user2: updated2 };
  }

  /**
   * Move participant between CONFIRMED (Main) and RESERVE
   */
  public static async moveParticipant(
    guildId: string,
    eventId: string,
    userId: string,
    targetStatus: 'CONFIRMED' | 'RESERVE',
    operatorId?: string,
    swapWithUserId?: string
  ): Promise<{ success: boolean; movedUser: any; demotedUser?: any; promotedUser?: any }> {
    const event = await prisma.eventGathering.findUnique({
      where: { id: eventId },
      include: { participants: { orderBy: { joinedAt: 'asc' } } },
    });

    if (!event) throw new Error('Мероприятие не найдено');

    const participant = event.participants.find(p => p.userId === userId);
    if (!participant) throw new Error('Участник не найден в списке');

    // If swap target is specified and statuses differ, perform clean swap
    if (swapWithUserId && swapWithUserId !== userId) {
      const swapTarget = event.participants.find(p => p.userId === swapWithUserId);
      if (swapTarget && swapTarget.status !== participant.status) {
        const swapRes = await this.swapParticipants(guildId, eventId, userId, swapWithUserId, operatorId);
        return {
          success: true,
          movedUser: swapRes.user1,
          demotedUser: participant.status === 'CONFIRMED' ? swapRes.user1 : swapRes.user2,
          promotedUser: participant.status === 'RESERVE' ? swapRes.user1 : swapRes.user2,
        };
      }
    }

    if (participant.status === targetStatus) {
      return { success: true, movedUser: participant };
    }

    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    const limit = event.participantLimit || 10;
    const confirmedParticipants = event.participants.filter(p => p.status === 'CONFIRMED');

    let demotedUser: any = null;

    if (targetStatus === 'CONFIRMED') {
      if (confirmedParticipants.length >= limit) {
        let lowestPart: any = null;
        let lowestScore = 9999999;
        for (const cp of confirmedParticipants) {
          const { score } = await this.getUserPriorityScore(guild, guildId, cp.userId);
          if (score < lowestScore) {
            lowestScore = score;
            lowestPart = cp;
          }
        }
        if (lowestPart) {
          await prisma.eventParticipant.update({
            where: { id: lowestPart.id },
            data: { status: 'RESERVE' },
          });
          demotedUser = lowestPart;
        }
      }

      const updated = await prisma.eventParticipant.update({
        where: { id: participant.id },
        data: { status: 'CONFIRMED' },
      });

      if (guild) {
        const mem = await guild.members.fetch(userId).catch(() => null);
        if (mem) {
          mem.send({
            content: `✅ Вы были переведены в **основной состав** на мероприятие **${event.title}**!`,
          }).catch(() => null);
        }
        if (demotedUser) {
          const demotedMem = await guild.members.fetch(demotedUser.userId).catch(() => null);
          if (demotedMem) {
            demotedMem.send({
              content: `⚠️ Место в основном составе на мероприятие **${event.title}** занял другой участник. Вы переведены в **резерв**.`,
            }).catch(() => null);
          }
        }
        await this.refreshAnnouncement(guild, eventId);

        const logEmbed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle(`🔄 Перемещение в основной состав: ${event.title}`)
          .setDescription(
            `Организатор ${operatorId ? `<@${operatorId}>` : 'Панель'} перевёл участника <@${userId}> в **основной состав**.\n` +
            (demotedUser ? `⚡ В резерв переведён: <@${demotedUser.userId}>.\n` : '') +
            `Мероприятие: **«${event.title}»**`
          )
          .setTimestamp();
        await AuditLogger.sendLog(guild, 'EVENTS', logEmbed);
      }

      return { success: true, movedUser: updated, demotedUser };
    } else {
      // Move to RESERVE: Do NOT auto-promote people from reserve! Slot stays open for manual filling.
      const updated = await prisma.eventParticipant.update({
        where: { id: participant.id },
        data: { status: 'RESERVE' },
      });

      if (guild) {
        await this.refreshAnnouncement(guild, eventId);

        const mem = await guild.members.fetch(userId).catch(() => null);
        if (mem) {
          mem.send({
            content: `⚠️ Организатор перевёл вас в **резерв** на мероприятие **${event.title}**.`,
          }).catch(() => null);
        }

        const logEmbed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle(`🔄 Перемещение в резерв: ${event.title}`)
          .setDescription(
            `Организатор ${operatorId ? `<@${operatorId}>` : 'Панель'} перевёл участника <@${userId}> в **резерв**.\n` +
            `Слот в основном составе освобождён для ручного распределения.\n` +
            `Мероприятие: **«${event.title}»**`
          )
          .setTimestamp();
        await AuditLogger.sendLog(guild, 'EVENTS', logEmbed);
      }

      return { success: true, movedUser: updated };
    }
  }

  /**
   * Rebalance roster based on configured role hierarchy
   */
  public static async rebalanceRoster(
    guildId: string,
    eventId: string,
    operatorId?: string
  ): Promise<{ success: boolean; confirmedCount: number; reserveCount: number }> {
    const event = await prisma.eventGathering.findUnique({
      where: { id: eventId },
      include: { participants: true },
    });

    if (!event) throw new Error('Мероприятие не найдено');

    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
    const limit = event.participantLimit || 10;

    const scoredParticipants: Array<{ participant: any; score: number }> = [];

    for (const p of event.participants) {
      const { score } = await this.getUserPriorityScore(guild, guildId, p.userId);
      scoredParticipants.push({ participant: p, score });
    }

    // Sort by score desc, then joinedAt asc
    scoredParticipants.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.participant.joinedAt.getTime() - b.participant.joinedAt.getTime();
    });

    let confirmedCount = 0;
    let reserveCount = 0;

    for (let i = 0; i < scoredParticipants.length; i++) {
      const { participant } = scoredParticipants[i];
      const targetStatus: 'CONFIRMED' | 'RESERVE' = i < limit ? 'CONFIRMED' : 'RESERVE';

      if (targetStatus === 'CONFIRMED') confirmedCount++;
      else reserveCount++;

      if (participant.status !== targetStatus) {
        await prisma.eventParticipant.update({
          where: { id: participant.id },
          data: { status: targetStatus },
        });
      }
    }

    if (guild) {
      await this.refreshAnnouncement(guild, eventId);
      const rebalanceEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`⚖️ Состав сбалансирован по иерархии ролей: ${event.title}`)
        .setDescription(
          `Администратор ${operatorId ? `<@${operatorId}>` : 'Панель'} выполнил автобалансировку состава.\n` +
          `• В основном составе: **${confirmedCount}/${limit}**\n` +
          `• В резерве: **${reserveCount}**`
        )
        .setTimestamp();
      await AuditLogger.sendLog(guild, 'EVENTS', rebalanceEmbed);
    }

    return { success: true, confirmedCount, reserveCount };
  }

  /**
   * Prompt host management panel with fast moving, kicking, and rebalancing
   */
  public static async promptManagement(interaction: ButtonInteraction, eventId: string): Promise<void> {
    const event = await prisma.eventGathering.findUnique({
      where: { id: eventId },
      include: {
        participants: { orderBy: { joinedAt: 'asc' } },
      },
    });

    if (!event) {
      await interaction.reply({ content: '❌ Мероприятие не найдено.', flags: MessageFlags.Ephemeral });
      return;
    }

    const member = interaction.member as GuildMember;
    const isOwner = event.createdById === interaction.user.id;
    const isAdmin = member?.permissions && typeof member.permissions.has === 'function'
      ? member.permissions.has('Administrator')
      : false;

    if (!isOwner && !isAdmin) {
      await interaction.reply({
        content: '❌ Только организатор мероприятия или администратор может управлять составом.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (event.participants.length === 0) {
      const finishBtnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`event_finish_${eventId}`)
          .setLabel('🏁 Завершить сбор')
          .setStyle(ButtonStyle.Danger)
      );
      await interaction.reply({
        content: 'ℹ️ В списке участников пока никого нет.',
        components: [finishBtnRow],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 1. Move menu (up to 25 participants)
    const moveOptions = event.participants.slice(0, 25).map(p => {
      const isConfirmed = p.status === 'CONFIRMED';
      return new StringSelectMenuOptionBuilder()
        .setLabel(isConfirmed ? `⬇️ В резерв: ${p.userTag || p.userId}` : `⬆️ В основу: ${p.userTag || p.userId}`)
        .setDescription(`Сейчас: ${isConfirmed ? 'Основа' : 'Резерв'} • ID: ${p.userId}`)
        .setValue(`move_${isConfirmed ? 'reserve' : 'confirmed'}_${p.userId}`);
    });

    const moveMenu = new StringSelectMenuBuilder()
      .setCustomId(`event_admin_move_${eventId}`)
      .setPlaceholder('🔄 Переместить (Основа ⇄ Резерв)...')
      .addOptions(moveOptions);

    // 2. Kick menu
    const kickOptions = event.participants.slice(0, 25).map(p => {
      return new StringSelectMenuOptionBuilder()
        .setLabel(`❌ Исключить: ${p.userTag || p.userId}`)
        .setDescription(`Статус: ${p.status === 'CONFIRMED' ? 'Основа' : 'Резерв'} • ID: ${p.userId}`)
        .setValue(`kick_${eventId}_${p.userId}`);
    });

    const kickMenu = new StringSelectMenuBuilder()
      .setCustomId(`event_admin_kick_${eventId}`)
      .setPlaceholder('❌ Исключить участника из сбора...')
      .addOptions(kickOptions);

    // 3. Action buttons (Rebalance, Finish)
    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`event_rebalance_${eventId}`)
        .setLabel('⚖️ Сбалансировать по ролям')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`event_finish_${eventId}`)
        .setLabel('🏁 Завершить сбор')
        .setStyle(ButtonStyle.Danger)
    );

    const components: any[] = [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(moveMenu),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(kickMenu),
      btnRow,
    ];

    await interaction.reply({
      content: `⚙️ **Панель управления сбором «${event.title}»**\n` +
        `• Чтобы перевести участника между основой и резервом — выберите его в первом меню.\n` +
        `• Чтобы исключить — выберите во втором меню.\n` +
        `• Кнопка «Сбалансировать по ролям» автоматически распределит основу и резерв по иерархии ролей!`,
      components,
      flags: MessageFlags.Ephemeral,
    });
  }

  /**
   * Handle admin move selection
   */
  public static async handleAdminMove(interaction: StringSelectMenuInteraction): Promise<void> {
    const value = interaction.values[0];
    const eventId = interaction.customId.replace('event_admin_move_', '');

    let targetStatus: 'CONFIRMED' | 'RESERVE' = 'CONFIRMED';
    let targetUserId = '';

    if (value.startsWith('move_reserve_')) {
      targetStatus = 'RESERVE';
      targetUserId = value.replace('move_reserve_', '');
    } else if (value.startsWith('move_confirmed_')) {
      targetStatus = 'CONFIRMED';
      targetUserId = value.replace('move_confirmed_', '');
    }

    if (!targetUserId || !eventId) {
      await interaction.reply({ content: '❌ Ошибка параметров перемещения.', flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      const res = await this.moveParticipant(
        interaction.guildId!,
        eventId,
        targetUserId,
        targetStatus,
        interaction.user.id
      );

      const statusName = targetStatus === 'CONFIRMED' ? 'основной состав' : 'резерв';
      let extra = '';
      if (res.demotedUser) {
        extra += `\n⚡ Из основы в резерв перемещён: <@${res.demotedUser.userId}> (освободил место).`;
      }
      if (res.promotedUser) {
        extra += `\n⬆️ Из резерва в основу перемещён: <@${res.promotedUser.userId}>.`;
      }

      await interaction.reply({
        content: `✅ <@${targetUserId}> успешно перемещён в **${statusName}**!${extra}`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err: any) {
      await interaction.reply({ content: `❌ Ошибка: ${err.message}`, flags: MessageFlags.Ephemeral });
    }
  }

  /**
   * Handle admin rebalance button
   */
  public static async handleAdminRebalance(interaction: ButtonInteraction, eventId: string): Promise<void> {
    try {
      const res = await this.rebalanceRoster(interaction.guildId!, eventId, interaction.user.id);
      await interaction.reply({
        content: `⚖️ Состав успешно сбалансирован по иерархии ролей!\n` +
          `👥 В основном составе: **${res.confirmedCount}** чел.\n` +
          `🪑 В резерве: **${res.reserveCount}** чел.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err: any) {
      await interaction.reply({ content: `❌ Ошибка балансировки: ${err.message}`, flags: MessageFlags.Ephemeral });
    }
  }

  /**
   * Handle admin finish button
   */
  public static async handleAdminFinish(interaction: ButtonInteraction, eventId: string): Promise<void> {
    const event = await prisma.eventGathering.findUnique({ where: { id: eventId } });
    if (!event) {
      await interaction.reply({ content: '❌ Мероприятие не найдено.', flags: MessageFlags.Ephemeral });
      return;
    }

    const now = new Date();
    await prisma.eventGathering.update({
      where: { id: eventId },
      data: { status: 'FINISHED', finishedAt: now },
    });

    const { EventScheduler } = await import('./eventScheduler');
    await EventScheduler.deleteEventReminder(event.guildId, eventId, event.channelId);

    const guild = await this.resolveGuild(interaction);
    if (guild) {
      await this.refreshAnnouncement(guild, eventId);
      const finishEmbed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle(`🏁 Сбор завершен: ${event.title}`)
        .setDescription(`Администратор <@${interaction.user.id}> завершил сбор на мероприятие **«${event.title}»**.`)
        .setTimestamp();
      await AuditLogger.sendLog(guild, 'EVENTS', finishEmbed);
    }

    await interaction.reply({ content: '🏁 Сбор успешно завершен.', flags: MessageFlags.Ephemeral });
  }

  /**
   * Handle admin kicking member via select menu
   */
  public static async handleAdminKick(interaction: StringSelectMenuInteraction): Promise<void> {
    const value = interaction.values[0];
    let eventId = interaction.customId.startsWith('event_admin_kick_')
      ? interaction.customId.replace('event_admin_kick_', '')
      : '';
    let targetUserId = value;

    if (value.startsWith('kick_')) {
      const rest = value.slice('kick_'.length);
      const lastUnderscore = rest.lastIndexOf('_');
      if (lastUnderscore !== -1) {
        eventId = rest.slice(0, lastUnderscore) || eventId;
        targetUserId = rest.slice(lastUnderscore + 1);
      } else {
        targetUserId = rest;
      }
    }

    const event = await prisma.eventGathering.findUnique({
      where: { id: eventId },
      include: { participants: { orderBy: { joinedAt: 'asc' } } },
    });

    if (!event) {
      await interaction.reply({ content: '❌ Мероприятие не найдено.', flags: MessageFlags.Ephemeral });
      return;
    }

    const targetParticipant = event.participants.find(p => p.userId === targetUserId);
    if (!targetParticipant) {
      await interaction.reply({ content: '❌ Участник уже не в списке.', flags: MessageFlags.Ephemeral });
      return;
    }

    await prisma.eventParticipant.delete({ where: { id: targetParticipant.id } });

    await interaction.reply({
      content: `✅ <@${targetUserId}> был исключен из состава. Слот свободен для ручного распределения.`,
      flags: MessageFlags.Ephemeral,
    });

    const guild = await this.resolveGuild(interaction);
    if (guild) {
      await this.refreshAnnouncement(guild, eventId);

      const kickEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`❌ Исключение с мероприятия: ${event.title}`)
        .setDescription(
          `Администратор/организатор <@${interaction.user.id}> исключил участника <@${targetUserId}> из мероприятия **«${event.title}»**.\n` +
          `Слот в составе освобождён для ручного распределения.`
        )
        .setTimestamp();
      await AuditLogger.sendLog(guild, 'EVENTS', kickEmbed);
    }
  }

  // --- API Server Database Abstractions ---
  static async getGuildConfig(guildId: string) {
    return await prisma.guildConfig.findUnique({ where: { guildId } });
  }

  static async upsertGuildConfig(guildId: string, update: any, create: any) {
    return await prisma.guildConfig.upsert({ where: { guildId }, update, create });
  }

  static async getEvents(whereClause: any) {
    return await prisma.eventGathering.findMany({
      where: whereClause,
      include: {
        participants: { orderBy: { joinedAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  static async getUserProfiles(guildId: string, userIds: string[]) {
    return await prisma.userProfile.findMany({
      where: { guildId, userId: { in: userIds } },
      select: { userId: true, characterName: true, userTag: true },
    });
  }

  static async createEvent(data: any) {
    return await prisma.eventGathering.create({ data });
  }

  static async updateEvent(id: string, data: any) {
    return await prisma.eventGathering.update({ where: { id }, data });
  }

  static async getEventByIdWithParticipants(id: string) {
    return await prisma.eventGathering.findUnique({
      where: { id },
      include: { participants: { orderBy: { joinedAt: 'asc' } } },
    });
  }

  static async deleteParticipant(id: string) {
    return await prisma.eventParticipant.delete({ where: { id } });
  }
}
