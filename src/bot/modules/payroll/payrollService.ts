import prisma from '../../../database/client';

export class PayrollService {
  static async getConfig(guildId: string) {
    let config = await prisma.recruiterSalaryConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      config = await prisma.recruiterSalaryConfig.create({
        data: {
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

    return config;
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
   * Calculate activity and payouts for recruiters within a given time period
   */
  static async calculatePayroll(guildId: string, periodStart: Date, periodEnd: Date) {
    const config = await this.getConfig(guildId);

    // 1. Accepted recruitment candidates
    const acceptedCandidates = await prisma.recruitmentApplication.findMany({
      where: {
        guildId,
        status: 'ACCEPTED',
        recruiterId: { not: null },
        closedAt: { gte: periodStart, lte: periodEnd },
      },
    });

    // 2. Rejected recruitment candidates
    const rejectedCandidates = await prisma.recruitmentApplication.findMany({
      where: {
        guildId,
        status: 'REJECTED',
        recruiterId: { not: null },
        closedAt: { gte: periodStart, lte: periodEnd },
      },
    });

    // 3. Approved MP reports
    const approvedReports = await prisma.mpReport.findMany({
      where: {
        guildId,
        status: 'APPROVED',
        reviewerId: { not: null },
        reviewedAt: { gte: periodStart, lte: periodEnd },
      },
    });

    // 4. Rejected MP reports
    const rejectedReports = await prisma.mpReport.findMany({
      where: {
        guildId,
        status: 'REJECTED',
        reviewerId: { not: null },
        reviewedAt: { gte: periodStart, lte: periodEnd },
      },
    });

    // 5. Completed academy promotions
    const promotions = await prisma.academyChannel.findMany({
      where: {
        guildId,
        status: 'PROMOTED',
        archivedAt: { gte: periodStart, lte: periodEnd },
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
    }>();

    const getOrInit = (id: string, tag?: string | null) => {
      if (!recruitersMap.has(id)) {
        recruitersMap.set(id, {
          recruiterId: id,
          recruiterTag: tag || id,
          acceptedCount: 0,
          rejectedCandidatesCount: 0,
          approvedReportsCount: 0,
          rejectedReportsCount: 0,
          promotionsCount: 0,
          totalPayout: 0,
        });
      }
      return recruitersMap.get(id)!;
    };

    // Credit accepted candidates
    for (const app of acceptedCandidates) {
      if (app.recruiterId) {
        const r = getOrInit(app.recruiterId, app.recruiterTag);
        r.acceptedCount += 1;
      }
    }

    // Credit rejected candidates
    for (const app of rejectedCandidates) {
      if (app.recruiterId) {
        const r = getOrInit(app.recruiterId, app.recruiterTag);
        r.rejectedCandidatesCount += 1;
      }
    }

    // Credit approved reports
    for (const rep of approvedReports) {
      if (rep.reviewerId) {
        const r = getOrInit(rep.reviewerId, rep.reviewerTag);
        r.approvedReportsCount += 1;
      }
    }

    // Credit rejected reports
    for (const rep of rejectedReports) {
      if (rep.reviewerId) {
        const r = getOrInit(rep.reviewerId, rep.reviewerTag);
        r.rejectedReportsCount += 1;
      }
    }

    // Credit promotions
    for (const promo of promotions) {
      const promoterId = promo.promotedById;
      if (promoterId) {
        const r = getOrInit(promoterId, promo.promotedByTag);
        r.promotionsCount += 1;
      }
    }

    // Calculate payouts
    const results = Array.from(recruitersMap.values()).map((rec) => {
      const payout =
        rec.acceptedCount * config.payPerCandidateAccepted +
        rec.rejectedCandidatesCount * config.payPerCandidateRejected +
        rec.approvedReportsCount * config.payPerApprovedReport +
        rec.rejectedReportsCount * config.payPerRejectedReport +
        rec.promotionsCount * config.payPerPromotion;

      rec.totalPayout = payout;
      return rec;
    });

    const grandTotal = results.reduce((acc, r) => acc + r.totalPayout, 0);

    return {
      periodStart,
      periodEnd,
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
