import prisma from '../../../database/client';
import { AuditLogger } from '../logging/auditLogger';

export class PayrollService {
  static async getConfig(guildId: string) {
    return await prisma.recruiterSalaryConfig.upsert({
      where: { guildId },
      update: {},
      create: {
        guildId,
        payPerCandidateAccepted: 10000,
        payPerCandidateRejected: 3000,
        payPerApprovedReport: 3000,
        payPerRejectedReport: 1500,
        payPerPromotion: 15000,
        currencySymbol: '$',
      },
    });
  }

  static async saveConfig(guildId: string, data: any) {
    return await prisma.recruiterSalaryConfig.upsert({
      where: { guildId },
      update: {
        payPerCandidateAccepted: parseFloat(data.payPerCandidateAccepted) || 10000,
        payPerCandidateRejected: parseFloat(data.payPerCandidateRejected) || 3000,
        payPerApprovedReport: parseFloat(data.payPerApprovedReport) || 3000,
        payPerRejectedReport: parseFloat(data.payPerRejectedReport) || 1500,
        payPerPromotion: parseFloat(data.payPerPromotion) || 15000,
        currencySymbol: data.currencySymbol || '$',
      },
      create: {
        guildId,
        payPerCandidateAccepted: parseFloat(data.payPerCandidateAccepted) || 10000,
        payPerCandidateRejected: parseFloat(data.payPerCandidateRejected) || 3000,
        payPerApprovedReport: parseFloat(data.payPerApprovedReport) || 3000,
        payPerRejectedReport: parseFloat(data.payPerRejectedReport) || 1500,
        payPerPromotion: parseFloat(data.payPerPromotion) || 15000,
        currencySymbol: data.currencySymbol || '$',
      },
    });
  }

  /**
   * Reset stats for all recruiters or an individual recruiter
   */
  static async resetStats(guildId: string, recruiterId?: string, executor?: { id: string; tag: string }) {
    const config = await this.getConfig(guildId);
    const now = new Date();

    if (!recruiterId) {
      // Global reset for all recruiters
      await prisma.recruiterSalaryConfig.update({
        where: { guildId },
        data: {
          lastResetAt: now,
          recruiterResetsJson: '{}',
        },
      });

      await AuditLogger.recordEntry({
        guildId,
        category: 'RECRUIT',
        action: 'RECRUITER_STATS_RESET_ALL',
        title: 'Обнуление статистики всех рекрутеров',
        description: `Администратор обнулил статистику всех рекрутеров. Отсчет начат с ${now.toLocaleString('ru-RU')}.`,
        executorId: executor?.id,
        executorTag: executor?.tag,
      }).catch(() => null);

      return { success: true, resetAt: now };
    } else {
      // Reset for a specific recruiter
      let resets: Record<string, string> = {};
      try {
        resets = JSON.parse(config.recruiterResetsJson || '{}');
      } catch {
        resets = {};
      }
      resets[recruiterId] = now.toISOString();

      await prisma.recruiterSalaryConfig.update({
        where: { guildId },
        data: {
          recruiterResetsJson: JSON.stringify(resets),
        },
      });

      await AuditLogger.recordEntry({
        guildId,
        category: 'RECRUIT',
        action: 'RECRUITER_STATS_RESET_USER',
        title: 'Обнуление статистики рекрутера',
        description: `Администратор обнулил статистику рекрутера <@${recruiterId}>. Отсчет начат с ${now.toLocaleString('ru-RU')}.`,
        executorId: executor?.id,
        executorTag: executor?.tag,
        targetId: recruiterId,
      }).catch(() => null);

      return { success: true, recruiterId, resetAt: now };
    }
  }

  /**
   * Clear reset checkpoint (revert to default date window)
   */
  static async clearReset(guildId: string, recruiterId?: string) {
    const config = await this.getConfig(guildId);

    if (!recruiterId) {
      await prisma.recruiterSalaryConfig.update({
        where: { guildId },
        data: {
          lastResetAt: null,
        },
      });
      return { success: true };
    } else {
      let resets: Record<string, string> = {};
      try {
        resets = JSON.parse(config.recruiterResetsJson || '{}');
      } catch {
        resets = {};
      }
      delete resets[recruiterId];

      await prisma.recruiterSalaryConfig.update({
        where: { guildId },
        data: {
          recruiterResetsJson: JSON.stringify(resets),
        },
      });
      return { success: true };
    }
  }

  /**
   * Calculate activity and payouts for recruiters within a given time period
   */
  static async calculatePayroll(guildId: string, periodStart: Date, periodEnd: Date) {
    const config = await this.getConfig(guildId);

    // Global reset check
    const effectiveStart = config.lastResetAt && config.lastResetAt > periodStart
      ? config.lastResetAt
      : periodStart;

    let recruiterResets: Record<string, string> = {};
    try {
      recruiterResets = JSON.parse(config.recruiterResetsJson || '{}');
    } catch {
      recruiterResets = {};
    }

    // 1. Accepted recruitment candidates
    const acceptedCandidates = await prisma.recruitmentApplication.findMany({
      where: {
        guildId,
        status: 'ACCEPTED',
        recruiterId: { not: null },
        closedAt: { gte: effectiveStart, lte: periodEnd },
      },
    });

    // 2. Rejected recruitment candidates
    const rejectedCandidates = await prisma.recruitmentApplication.findMany({
      where: {
        guildId,
        status: 'REJECTED',
        recruiterId: { not: null },
        closedAt: { gte: effectiveStart, lte: periodEnd },
      },
    });

    // 3. Approved MP reports
    const approvedReports = await prisma.mpReport.findMany({
      where: {
        guildId,
        status: 'APPROVED',
        reviewerId: { not: null },
        reviewedAt: { gte: effectiveStart, lte: periodEnd },
      },
    });

    // 4. Rejected MP reports
    const rejectedReports = await prisma.mpReport.findMany({
      where: {
        guildId,
        status: 'REJECTED',
        reviewerId: { not: null },
        reviewedAt: { gte: effectiveStart, lte: periodEnd },
      },
    });

    // 5. Completed academy promotions
    const promotions = await prisma.academyChannel.findMany({
      where: {
        guildId,
        status: 'PROMOTED',
        archivedAt: { gte: effectiveStart, lte: periodEnd },
      },
    });

    // Map by recruiter ID
    const recruitersMap = new Map<string, {
      recruiterId: string;
      recruiterTag: string;
      acceptedCount: number;
      rejectedCandidatesCount: number;
      approvedReportsCount: number;
      rejectedReportsCount: number;
      promotionsCount: number;
      totalPayout: number;
      isReset?: boolean;
      resetAt?: string | null;
    }>();

    const getOrInit = (id: string, tag?: string | null) => {
      if (!recruitersMap.has(id)) {
        const recReset = recruiterResets[id] || null;
        recruitersMap.set(id, {
          recruiterId: id,
          recruiterTag: tag || id,
          acceptedCount: 0,
          rejectedCandidatesCount: 0,
          approvedReportsCount: 0,
          rejectedReportsCount: 0,
          promotionsCount: 0,
          totalPayout: 0,
          isReset: Boolean(recReset),
          resetAt: recReset,
        });
      }
      return recruitersMap.get(id)!;
    };

    // Credit accepted candidates
    for (const app of acceptedCandidates) {
      if (app.recruiterId) {
        const recReset = recruiterResets[app.recruiterId];
        if (recReset && app.closedAt && app.closedAt <= new Date(recReset)) {
          continue;
        }
        const r = getOrInit(app.recruiterId, app.recruiterTag);
        r.acceptedCount += 1;
      }
    }

    // Credit rejected candidates
    for (const app of rejectedCandidates) {
      if (app.recruiterId) {
        const recReset = recruiterResets[app.recruiterId];
        if (recReset && app.closedAt && app.closedAt <= new Date(recReset)) {
          continue;
        }
        const r = getOrInit(app.recruiterId, app.recruiterTag);
        r.rejectedCandidatesCount += 1;
      }
    }

    // Credit approved reports
    for (const rep of approvedReports) {
      if (rep.reviewerId) {
        const recReset = recruiterResets[rep.reviewerId];
        if (recReset && rep.reviewedAt && rep.reviewedAt <= new Date(recReset)) {
          continue;
        }
        const r = getOrInit(rep.reviewerId, rep.reviewerTag);
        r.approvedReportsCount += 1;
      }
    }

    // Credit rejected reports
    for (const rep of rejectedReports) {
      if (rep.reviewerId) {
        const recReset = recruiterResets[rep.reviewerId];
        if (recReset && rep.reviewedAt && rep.reviewedAt <= new Date(recReset)) {
          continue;
        }
        const r = getOrInit(rep.reviewerId, rep.reviewerTag);
        r.rejectedReportsCount += 1;
      }
    }

    // Credit promotions
    for (const promo of promotions) {
      const promoterId = promo.promotedById;
      if (promoterId) {
        const recReset = recruiterResets[promoterId];
        if (recReset && promo.archivedAt && promo.archivedAt <= new Date(recReset)) {
          continue;
        }
        const r = getOrInit(promoterId, promo.promotedByTag);
        r.promotionsCount += 1;
      }
    }

    // Ensure recruiters with active individual reset appear even if they have 0 actions
    for (const [recId, recReset] of Object.entries(recruiterResets)) {
      if (!recruitersMap.has(recId)) {
        getOrInit(recId);
      }
    }

    // Calculate payouts
    const recruiterIds = Array.from(recruitersMap.keys());
    const profiles = await prisma.userProfile.findMany({
      where: { guildId, userId: { in: recruiterIds } },
      include: { characters: true },
    });
    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    const results = Array.from(recruitersMap.values()).map((rec) => {
      const payout =
        rec.acceptedCount * config.payPerCandidateAccepted +
        rec.rejectedCandidatesCount * config.payPerCandidateRejected +
        rec.approvedReportsCount * config.payPerApprovedReport +
        rec.rejectedReportsCount * config.payPerRejectedReport +
        rec.promotionsCount * config.payPerPromotion;

      const profile = profileMap.get(rec.recruiterId);
      const mainChar = profile?.characters?.find((c: any) => c.isMain) || profile?.characters?.[0];
      const staticId = mainChar?.staticId || profile?.staticId || '';
      const characterName = mainChar?.characterName || profile?.characterName || '';

      rec.totalPayout = payout;
      return {
        ...rec,
        staticId,
        characterName,
        exportRow: `${staticId || 'БЕЗ_СТАТИКА'};${payout};Зарплата рекрутера`,
      };
    });

    const grandTotal = results.reduce((acc, r) => acc + r.totalPayout, 0);

    return {
      periodStart,
      periodEnd,
      effectiveStart,
      lastResetAt: config.lastResetAt,
      recruiterResets,
      currencySymbol: config.currencySymbol,
      rates: {
        payPerCandidateAccepted: config.payPerCandidateAccepted,
        payPerCandidateRejected: config.payPerCandidateRejected,
        payPerApprovedReport: config.payPerApprovedReport,
        payPerRejectedReport: config.payPerRejectedReport,
        payPerPromotion: config.payPerPromotion,
      },
      recruiters: results.sort((a, b) => b.totalPayout - a.totalPayout),
      grandTotal,
    };
  }
}

