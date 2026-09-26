import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import prisma from '../../../database/client';
import { AuditLogger } from '../logging/auditLogger';
import { THEME, createThemedEmbed } from '../../utils/theme';
import { BotMessageManager } from '../../utils/botMessageManager';

export type LeaveType = 'VACATION' | 'TIMEOFF';

export class LeaveService {
  /**
   * Request a leave of absence (VACATION or TIMEOFF)
   */
  static async requestLeave(
    guildId: string,
    userId: string,
    userTag: string,
    startDate: Date,
    endDate: Date,
    reason: string,
    type: LeaveType = 'VACATION'
  ) {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    if (isNaN(startMs) || isNaN(endMs)) {
      throw new Error('Некорректный формат дат');
    }
    if (endMs <= startMs) {
      throw new Error('Дата окончания должна быть позже даты начала');
    }

    const diffMs = endMs - startMs;
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (type === 'VACATION') {
      if (diffDays < 1) {
        throw new Error('Минимальная продолжительность отпуска — 1 день');
      }
      if (diffDays > 14) {
        throw new Error('Максимальная продолжительность отпуска — 14 дней (2 недели)');
      }
    } else if (type === 'TIMEOFF') {
      if (diffMinutes < 5) {
        throw new Error('Минимальная продолжительность отгула — 5 минут');
      }
      if (diffMinutes > 24 * 60) {
        throw new Error('Максимальная продолжительность отгула — 24 часа');
      }
    }

    const existingPending = await prisma.leaveRequest.findFirst({
      where: { guildId, userId, status: 'PENDING' },
    });
    if (existingPending) {
      throw new Error('У вас уже есть активная заявка на рассмотрении');
    }

    // Ensure UserProfile exists before inserting LeaveRequest due to foreign key constraint
    await prisma.userProfile.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: { userTag },
      create: { guildId, userId, userTag },
    });

    const leave = await prisma.leaveRequest.create({
      data: {
        guildId,
        userId,
        userTag,
        type,
        startDate,
        endDate,
        reason,
        status: 'PENDING',
      },
    });

    await AuditLogger.recordEntry({
      guildId,
      action: 'LEAVE_REQUESTED',
      category: 'LEAVE',
      title: 'Подана заявка на отсутствие',
      description: `Подана заявка на ${type === 'VACATION' ? 'отпуск' : 'отгул'}: ${reason}`,
      executorId: userId,
      executorTag: userTag,
      targetId: userId,
      targetTag: userTag,
    }).catch(() => null);

    // Send DM to member
    BotMessageManager.sendDM(guildId, userId, 'leave_dm_submitted', {
      user: `<@${userId}>`,
      username: userTag,
      leaveType: type === 'VACATION' ? 'Отпуск' : 'Отгул',
      startDate: startDate.toLocaleDateString('ru-RU'),
      endDate: endDate.toLocaleDateString('ru-RU'),
      days: `${diffDays} дн.`,
    }).catch(() => null);

    return leave;
  }

  /**
   * Review leave request (Approve / Reject)
   */
  static async reviewLeave(
    requestId: string,
    reviewerId: string,
    reviewerTag: string,
    approved: boolean,
    rejectionReason?: string
  ) {
    const leave = await prisma.leaveRequest.findUnique({ where: { id: requestId } });
    if (!leave) throw new Error('Заявка на отпуск не найдена');

    const updated = await prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        reviewerId,
        reviewerTag,
        rejectionReason: approved ? null : (rejectionReason || 'Отклонено руководством'),
        reviewedAt: new Date(),
      },
    });

    if (approved) {
      await prisma.userProfile.updateMany({
        where: { guildId: leave.guildId, userId: leave.userId },
        data: {
          status: 'ON_LEAVE',
          leaveUntil: leave.endDate,
        },
      });
    }

    await AuditLogger.recordEntry({
      guildId: leave.guildId,
      action: approved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      category: 'LEAVE',
      title: `${approved ? 'Одобрена' : 'Отклонена'} заявка на ${leave.type === 'VACATION' ? 'отпуск' : 'отгул'}`,
      description: `${approved ? 'Одобрен' : 'Отклонен'} ${leave.type === 'VACATION' ? 'отпуск' : 'отгул'} для ${leave.userTag}. ${rejectionReason ? `Причина: ${rejectionReason}` : ''}`,
      executorId: reviewerId,
      executorTag: reviewerTag,
      targetId: leave.userId,
      targetTag: leave.userTag,
    }).catch(() => null);

    // Send DM to member
    const templateKey = approved ? 'leave_dm_approved' : 'leave_dm_rejected';
    BotMessageManager.sendDM(leave.guildId, leave.userId, templateKey, {
      user: `<@${leave.userId}>`,
      username: leave.userTag || leave.userId,
      leaveType: leave.type === 'VACATION' ? 'Отпуск' : 'Отгул',
      startDate: leave.startDate.toLocaleDateString('ru-RU'),
      endDate: leave.endDate.toLocaleDateString('ru-RU'),
      admin: `<@${reviewerId}>`,
      reason: rejectionReason || 'Не указана',
    }).catch(() => null);

    return updated;
  }

  /**
   * Get currently active leaves (status APPROVED and endDate >= now)
   */
  static async getActiveLeaves(guildId: string) {
    const now = new Date();
    const active = await prisma.leaveRequest.findMany({
      where: {
        guildId,
        status: 'APPROVED',
        endDate: { gte: now },
      },
      orderBy: { endDate: 'asc' },
    });

    // Attach user profile & character info
    const userIds = active.map(a => a.userId);
    const profiles = await prisma.userProfile.findMany({
      where: { guildId, userId: { in: userIds } },
      include: { characters: true },
    });
    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    return active.map(item => {
      const p = profileMap.get(item.userId);
      const remainingMs = Math.max(0, item.endDate.getTime() - now.getTime());
      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const remainingDays = Math.floor(remainingHours / 24);
      const remHoursOnly = remainingHours % 24;
      const remainingMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

      let remainingText = '';
      if (remainingDays > 0) {
        remainingText = `${remainingDays} д. ${remHoursOnly} ч.`;
      } else if (remainingHours > 0) {
        remainingText = `${remainingHours} ч. ${remainingMins} мин.`;
      } else {
        remainingText = `${remainingMins} мин.`;
      }

      return {
        ...item,
        profile: p || null,
        remainingMs,
        remainingText,
      };
    });
  }

  /**
   * Get all requests
   */
  static async getAllRequests(guildId: string, status?: string) {
    const requests = await prisma.leaveRequest.findMany({
      where: {
        guildId,
        ...(status && status !== 'ALL' ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const userIds = requests.map(r => r.userId);
    const profiles = await prisma.userProfile.findMany({
      where: { guildId, userId: { in: userIds } },
      include: { characters: true },
    });
    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    return requests.map(r => ({
      ...r,
      profile: profileMap.get(r.userId) || null,
    }));
  }

  /**
   * Get audit history/logs of leaves
   */
  static async getLeaveLogs(guildId: string) {
    const logs = await prisma.leaveRequest.findMany({
      where: {
        guildId,
        status: { in: ['APPROVED', 'REJECTED'] },
      },
      orderBy: { reviewedAt: 'desc' },
      take: 100,
    });

    const userIds = logs.map(l => l.userId);
    const profiles = await prisma.userProfile.findMany({
      where: { guildId, userId: { in: userIds } },
      include: { characters: true },
    });
    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    return logs.map(l => ({
      ...l,
      profile: profileMap.get(l.userId) || null,
    }));
  }

  /**
   * Deploy interactive button panel in a Discord channel to let members submit leave requests
   */
  static async deployLeavePanel(channel: TextChannel) {
    const rendered = await BotMessageManager.renderMessage(channel.guild.id, 'leave_request_panel', {
      guild: channel.guild.name,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('panel_request_vacation')
        .setLabel('Отпуск (1 - 14 дней)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('panel_request_timeoff')
        .setLabel('Отгул (до 24 часов)')
        .setStyle(ButtonStyle.Secondary)
    );

    return await channel.send({
      content: rendered.content,
      embeds: [rendered.embed],
      components: [row],
    });
  }
}



