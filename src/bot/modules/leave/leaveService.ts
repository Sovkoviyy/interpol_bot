import prisma from '../../../database/client';

export class LeaveService {
  /**
   * Request a leave of absence
   */
  static async requestLeave(
    guildId: string,
    userId: string,
    userTag: string,
    startDate: Date,
    endDate: Date,
    reason: string
  ) {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    if (isNaN(startMs) || isNaN(endMs)) {
      throw new Error('Некорректный формат дат отпуска');
    }
    if (endMs <= startMs) {
      throw new Error('Дата окончания отпуска должна быть позже даты начала');
    }
    const diffDays = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24));
    if (diffDays > 14) {
      throw new Error('Максимальная продолжительность отпуска — 14 дней (2 недели)');
    }

    return await prisma.leaveRequest.create({
      data: {
        guildId,
        userId,
        userTag,
        startDate,
        endDate,
        reason,
        status: 'PENDING',
      },
    });
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

    return updated;
  }

  /**
   * Get active leaves
   */
  static async getActiveLeaves(guildId: string) {
    const now = new Date();
    return await prisma.leaveRequest.findMany({
      where: {
        guildId,
        status: 'APPROVED',
        endDate: { gte: now },
      },
      orderBy: { endDate: 'asc' },
    });
  }

  /**
   * Get all requests
   */
  static async getAllRequests(guildId: string, status?: string) {
    return await prisma.leaveRequest.findMany({
      where: {
        guildId,
        ...(status && status !== 'ALL' ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
