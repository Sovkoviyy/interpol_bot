import { EmbedBuilder, Guild, TextChannel } from 'discord.js';
import prisma from '../../../database/client';
import bot from '../../client';
import { AuditLogger } from '../logging/auditLogger';
import { ensureDatabaseSchema } from '../../../database/ensureSchema';

export class PayrollService {
  /**
   * Calculates Monday 00:00:00.000 to Sunday 23:59:59.999 in Moscow Time (Europe/Moscow, UTC+3).
   * Ensures the week transitions precisely at 00:00 MSK on Monday, regardless of VPS timezone.
   */
  public static getWeekRange(referenceDate: Date = new Date()): { start: Date; end: Date } {
    const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
    const msk = new Date(referenceDate.getTime() + MSK_OFFSET_MS);

    const day = msk.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const mskYear = msk.getUTCFullYear();
    const mskMonth = msk.getUTCMonth();
    const mskDate = msk.getUTCDate() + diffToMonday;

    // Monday 00:00:00.000 MSK expressed in UTC Date
    const mondayUtcMs = Date.UTC(mskYear, mskMonth, mskDate, 0, 0, 0, 0) - MSK_OFFSET_MS;
    // Sunday 23:59:59.999 MSK expressed in UTC Date
    const sundayUtcMs = Date.UTC(mskYear, mskMonth, mskDate + 6, 23, 59, 59, 999) - MSK_OFFSET_MS;

    return {
      start: new Date(mondayUtcMs),
      end: new Date(sundayUtcMs),
    };
  }

  /**
   * Calculates the previous completed week (previous Monday to previous Sunday in MSK)
   */
  public static getPreviousWeekRange(referenceDate: Date = new Date()): { start: Date; end: Date } {
    const currentWeek = this.getWeekRange(referenceDate);
    const prevMonday = new Date(currentWeek.start.getTime() - 7 * 24 * 3600 * 1000);
    const prevSunday = new Date(currentWeek.start.getTime() - 1);

    return { start: prevMonday, end: prevSunday };
  }

  /**
   * Formats a date range like "28.09 — 04.10" according to Moscow Time
   */
  public static formatRangeString(start: Date, end: Date): string {
    const f = (d: Date) => d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit' });
    return `${f(start)} — ${f(end)}`;
  }

  /**
   * Resolves the recruiter display name according to the rule:
   * 1. If character name is bound (with or without static), use character name (e.g. "Tony Stark [142055]" or "Tony Stark")
   * 2. Else use Discord server nickname (member.nickname or member.displayName)
   * 3. Fallback to Discord username / tag
   */
  public static resolveRecruiterDisplayName(
    member: { nickname?: string | null; displayName?: string | null } | null,
    profile: { characterName?: string | null; staticId?: string | null; characters?: any[] } | null,
    fallbackTag?: string | null,
    fallbackId?: string
  ): { displayName: string; staticId: string; characterName: string } {
    const mainChar = profile?.characters?.find((c: any) => c.isMain) || profile?.characters?.[0];
    const characterName = (mainChar?.characterName || profile?.characterName || '').trim();
    const staticId = (mainChar?.staticId || profile?.staticId || '').trim();

    let displayName = '';
    if (characterName) {
      displayName = staticId ? `${characterName} [${staticId}]` : characterName;
    } else if (member?.nickname) {
      displayName = member.nickname.trim();
    } else if (member?.displayName) {
      displayName = member.displayName.trim();
    } else {
      displayName = (fallbackTag || fallbackId || 'Рекрутер').split('#')[0];
    }

    return { displayName, staticId, characterName };
  }

  /**
   * Get salary configuration for guild
   */
  public static async getConfig(guildId: string) {
    try {
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
          autoWeeklyReset: true,
        },
      });
    } catch (err: any) {
      if (err?.message?.includes('lastResetAt') || err?.message?.includes('does not exist')) {
        await ensureDatabaseSchema();
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
            autoWeeklyReset: true,
          },
        });
      }
      throw err;
    }
  }

  /**
   * Save salary configuration
   */
  public static async saveConfig(guildId: string, data: any) {
    const payload = data?.config || data || {};
    const parseRate = (val: any, fallback: number) => {
      if (val === undefined || val === null || val === '') return fallback;
      const num = Number(val);
      return isNaN(num) ? fallback : num;
    };

    const accepted = parseRate(payload.payPerCandidateAccepted, 10000);
    const rejected = parseRate(payload.payPerCandidateRejected, 3000);
    const approvedRep = parseRate(payload.payPerApprovedReport, 3000);
    const rejectedRep = parseRate(payload.payPerRejectedReport, 1500);
    const promotion = parseRate(payload.payPerPromotion, 15000);
    const currency = typeof payload.currencySymbol === 'string' && payload.currencySymbol.trim() ? payload.currencySymbol.trim() : '$';
    const payoutChannelId = payload.payoutChannelId !== undefined ? (payload.payoutChannelId ? String(payload.payoutChannelId).trim() : null) : undefined;
    const autoWeeklyReset = payload.autoWeeklyReset !== undefined ? Boolean(payload.autoWeeklyReset) : undefined;

    return await prisma.recruiterSalaryConfig.upsert({
      where: { guildId },
      update: {
        payPerCandidateAccepted: accepted,
        payPerCandidateRejected: rejected,
        payPerApprovedReport: approvedRep,
        payPerRejectedReport: rejectedRep,
        payPerPromotion: promotion,
        currencySymbol: currency,
        ...(payoutChannelId !== undefined ? { payoutChannelId } : {}),
        ...(autoWeeklyReset !== undefined ? { autoWeeklyReset } : {}),
      },
      create: {
        guildId,
        payPerCandidateAccepted: accepted,
        payPerCandidateRejected: rejected,
        payPerApprovedReport: approvedRep,
        payPerRejectedReport: rejectedRep,
        payPerPromotion: promotion,
        currencySymbol: currency,
        payoutChannelId: payoutChannelId || null,
        autoWeeklyReset: autoWeeklyReset !== undefined ? autoWeeklyReset : true,
      },
    });
  }

  private static toTimestamp(val: any): number {
    if (!val) return 0;
    if (val instanceof Date) return val.getTime();
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  /**
   * Calculate activity and payouts for recruiters within a given time period (defaults to current week Monday-Sunday)
   */
  public static async calculatePayroll(guildId: string, requestedStart?: Date, requestedEnd?: Date) {
    const config = await this.getConfig(guildId);
    const week = this.getWeekRange(new Date());

    const periodStart = requestedStart || week.start;
    const periodEnd = requestedEnd || week.end;

    // Respect lastResetAt safely via timestamps so resets take immediate effect regardless of Date/string types
    const resetTime = this.toTimestamp(config.lastResetAt);
    const startTime = this.toTimestamp(periodStart);
    const effectiveStart = resetTime > startTime ? new Date(resetTime) : periodStart;

    let recruiterResets: Record<string, string> = {};
    try {
      recruiterResets = JSON.parse(config.recruiterResetsJson || '{}');
    } catch {
      recruiterResets = {};
    }

    // 1. Accepted candidates (fallback to createdAt if closedAt was not populated)
    const acceptedCandidates = await prisma.recruitmentApplication.findMany({
      where: {
        guildId,
        status: 'ACCEPTED',
        recruiterId: { not: null },
        OR: [
          { closedAt: { gte: effectiveStart, lte: periodEnd } },
          { closedAt: null, createdAt: { gte: effectiveStart, lte: periodEnd } },
        ],
      },
    });

    // 2. Rejected candidates (fallback to createdAt if closedAt was not populated)
    const rejectedCandidates = await prisma.recruitmentApplication.findMany({
      where: {
        guildId,
        status: 'REJECTED',
        recruiterId: { not: null },
        OR: [
          { closedAt: { gte: effectiveStart, lte: periodEnd } },
          { closedAt: null, createdAt: { gte: effectiveStart, lte: periodEnd } },
        ],
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

    // 5. Completed promotions
    const promotions = await prisma.academyChannel.findMany({
      where: {
        guildId,
        status: 'PROMOTED',
        archivedAt: { gte: effectiveStart, lte: periodEnd },
      },
    });

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
      if (recruiterResets[id] === 'HIDDEN') return null;
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

    // Credit candidates
    for (const app of acceptedCandidates) {
      if (app.recruiterId) {
        const recResetTime = this.toTimestamp(recruiterResets[app.recruiterId]);
        const appTime = this.toTimestamp(app.closedAt || app.createdAt);
        if (recResetTime > 0 && appTime <= recResetTime) continue;
        const r = getOrInit(app.recruiterId, app.recruiterTag);
        if (r) r.acceptedCount += 1;
      }
    }

    for (const app of rejectedCandidates) {
      if (app.recruiterId) {
        const recResetTime = this.toTimestamp(recruiterResets[app.recruiterId]);
        const appTime = this.toTimestamp(app.closedAt || app.createdAt);
        if (recResetTime > 0 && appTime <= recResetTime) continue;
        const r = getOrInit(app.recruiterId, app.recruiterTag);
        if (r) r.rejectedCandidatesCount += 1;
      }
    }

    // Credit reports
    for (const rep of approvedReports) {
      if (rep.reviewerId) {
        const recResetTime = this.toTimestamp(recruiterResets[rep.reviewerId]);
        const repTime = this.toTimestamp(rep.reviewedAt || rep.createdAt);
        if (recResetTime > 0 && repTime <= recResetTime) continue;
        const r = getOrInit(rep.reviewerId, rep.reviewerTag);
        if (r) r.approvedReportsCount += 1;
      }
    }

    for (const rep of rejectedReports) {
      if (rep.reviewerId) {
        const recResetTime = this.toTimestamp(recruiterResets[rep.reviewerId]);
        const repTime = this.toTimestamp(rep.reviewedAt || rep.createdAt);
        if (recResetTime > 0 && repTime <= recResetTime) continue;
        const r = getOrInit(rep.reviewerId, rep.reviewerTag);
        if (r) r.rejectedReportsCount += 1;
      }
    }

    // Credit promotions
    for (const promo of promotions) {
      const promoterId = promo.promotedById;
      if (promoterId) {
        const recResetTime = this.toTimestamp(recruiterResets[promoterId]);
        const promoTime = this.toTimestamp(promo.archivedAt || promo.updatedAt);
        if (recResetTime > 0 && promoTime <= recResetTime) continue;
        const r = getOrInit(promoterId, promo.promotedByTag);
        if (r) r.promotionsCount += 1;
      }
    }

    for (const [recId, recReset] of Object.entries(recruiterResets)) {
      if (recReset === 'HIDDEN') continue;
      if (!recruitersMap.has(recId)) {
        getOrInit(recId);
      }
    }

    // Resolve recruiter names and character profiles
    const recruiterIds = Array.from(recruitersMap.keys());
    const profiles = await prisma.userProfile.findMany({
      where: { guildId, userId: { in: recruiterIds } },
      include: { characters: true },
    });
    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    // Fetch Discord Guild & Members for nickname resolution
    const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);

    const results = await Promise.all(
      Array.from(recruitersMap.values()).map(async (rec) => {
        const payout =
          rec.acceptedCount * config.payPerCandidateAccepted +
          rec.rejectedCandidatesCount * config.payPerCandidateRejected +
          rec.approvedReportsCount * config.payPerApprovedReport +
          rec.rejectedReportsCount * config.payPerRejectedReport +
          rec.promotionsCount * config.payPerPromotion;

        const profile = profileMap.get(rec.recruiterId) || null;
        let member: any = null;
        if (guild) {
          member = guild.members.cache.get(rec.recruiterId) || await guild.members.fetch(rec.recruiterId).catch(() => null);
        }

        const { displayName, staticId, characterName } = this.resolveRecruiterDisplayName(
          member,
          profile,
          rec.recruiterTag,
          rec.recruiterId
        );

        const cleanStatic = staticId ? String(staticId).replace(/^#/, '').trim() : '';
        rec.totalPayout = payout;
        return {
          ...rec,
          displayName,
          staticId: cleanStatic || null,
          characterName,
          exportRow: cleanStatic ? `${cleanStatic};${Math.round(payout)};Премия` : '',
        };
      })
    );

    const grandTotal = results.reduce((acc, r) => acc + r.totalPayout, 0);

    return {
      periodStart,
      periodEnd,
      effectiveStart,
      lastResetAt: config.lastResetAt,
      recruiterResets,
      currencySymbol: config.currencySymbol,
      payoutChannelId: config.payoutChannelId,
      autoWeeklyReset: config.autoWeeklyReset,
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

  /**
   * Finalizes the current weekly payroll, creates immutable RecruiterPayoutRecords,
   * resets the active tracking counters, and posts the report + new week announcement to Discord.
   */
  public static async archiveAndResetWeek(
    guildId: string,
    options: {
      executor?: { id: string; tag: string };
      isAutomatic?: boolean;
    } = {}
  ): Promise<{ success: boolean; recordsCreated: number; resetAt: Date; periodString: string }> {
    const config = await this.getConfig(guildId);
    const now = new Date();

    // 1. Calculate the active payroll up to now
    const week = this.getWeekRange(now);
    const resetDate = config.lastResetAt ? new Date(config.lastResetAt) : null;
    const periodStart = resetDate || week.start;
    const periodEnd = now;
    const periodString = this.formatRangeString(periodStart, periodEnd);

    const payroll = await this.calculatePayroll(guildId, periodStart, periodEnd);

    // 2. Create payout records in database for all recruiters with activity or payout
    const createdRecords: any[] = [];
    for (const rec of payroll.recruiters) {
      if (rec.totalPayout > 0 || rec.acceptedCount > 0 || rec.approvedReportsCount > 0) {
        const record = await prisma.recruiterPayoutRecord.create({
          data: {
            guildId,
            recruiterId: rec.recruiterId,
            recruiterTag: rec.recruiterTag,
            recruiterName: rec.displayName,
            staticId: rec.staticId || null,
            periodStart,
            periodEnd,
            acceptedCount: rec.acceptedCount,
            rejectedCandidatesCount: rec.rejectedCandidatesCount,
            reportsCount: rec.approvedReportsCount,
            rejectedReportsCount: rec.rejectedReportsCount,
            promotionsCount: rec.promotionsCount,
            totalPayout: rec.totalPayout,
            status: 'PENDING',
            notes: options.isAutomatic ? 'Автоматический сброс по окончании недели' : `Ручное формирование (${options.executor?.tag || 'Администратор'})`,
          },
        });
        createdRecords.push(record);
      }
    }

    // 3. Update config with reset timestamp and current week Monday
    const nextWeekRange = this.getWeekRange(now);
    await prisma.recruiterSalaryConfig.upsert({
      where: { guildId },
      update: {
        lastResetAt: now,
        currentWeekMonday: nextWeekRange.start,
        recruiterResetsJson: '{}',
      },
      create: {
        guildId,
        lastResetAt: now,
        currentWeekMonday: nextWeekRange.start,
        recruiterResetsJson: '{}',
      },
    });

    // 4. Send announcement to Discord payout channel if configured
    await this.postWeeklyAnnouncementToDiscord(guildId, config.payoutChannelId, payroll, periodString, nextWeekRange);

    // 5. Audit log
    await AuditLogger.recordEntry({
      guildId,
      category: 'RECRUIT',
      action: options.isAutomatic ? 'RECRUITER_WEEKLY_AUTORESET' : 'RECRUITER_STATS_RESET_ALL',
      title: options.isAutomatic ? 'Автоматический недельный расчет выплат рекрутерам' : 'Формирование выплат и обнуление недели рекрутеров',
      description: `Сформировано ${createdRecords.length} выплат на сумму ${config.currencySymbol}${payroll.grandTotal.toLocaleString('ru-RU')} за период ${periodString}.`,
      executorId: options.executor?.id,
      executorTag: options.executor?.tag,
    }).catch(() => null);

    return {
      success: true,
      recordsCreated: createdRecords.length,
      resetAt: now,
      periodString,
    };
  }

  /**
   * Posts the weekly payout summary and new week start announcement to Discord
   */
  public static async postWeeklyAnnouncementToDiscord(
    guildId: string,
    payoutChannelId: string | null | undefined,
    payroll: any,
    periodString: string,
    nextWeekRange: { start: Date; end: Date }
  ): Promise<void> {
    if (!payoutChannelId) return;

    try {
      const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;

      const channel = (guild.channels.cache.get(payoutChannelId) || await guild.channels.fetch(payoutChannelId).catch(() => null)) as TextChannel | null;
      if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') return;

      const sym = payroll.currencySymbol || '$';
      const grandTotalFormatted = `${sym}${payroll.grandTotal.toLocaleString('ru-RU')}`;

      // Build payout summary embed
      const summaryEmbed = new EmbedBuilder()
        .setColor(0xEC4899) // Hot pink
        .setTitle(`📊 Итоговые выплаты рекрутерам за неделю (${periodString})`)
        .setDescription(
          `Завершена расчетная неделя рекрутинга! Сформированы ведомости выплат для выдачи в игре.\n` +
          `💰 **Общая сумма к выплате:** **${grandTotalFormatted}**\n` +
          `👥 **Всего рекрутеров:** **${payroll.recruiters.length}**`
        )
        .setTimestamp();

      if (payroll.recruiters.length > 0) {
        // Group recruiters into fields (up to 15 recruiters per field or individual fields)
        const recruiterLines = payroll.recruiters.map((r: any, idx: number) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '▫️';
          const staticBadge = r.staticId ? ` \`[#${r.staticId}]\`` : '';
          const statsBrief = `принято: **${r.acceptedCount}** | отчетов: **${r.approvedReportsCount}** | повышений: **${r.promotionsCount}**`;
          return `${medal} **${r.displayName}**${staticBadge}\n   └ ${statsBrief} → **${sym}${r.totalPayout.toLocaleString('ru-RU')}**`;
        });

        // Split into chunks of 10 if necessary
        const chunkSize = 10;
        for (let i = 0; i < recruiterLines.length; i += chunkSize) {
          const chunk = recruiterLines.slice(i, i + chunkSize).join('\n\n');
          summaryEmbed.addFields({
            name: i === 0 ? '📋 Список к выплате:' : '📋 Список (продолжение):',
            value: chunk.slice(0, 1024),
          });
        }
      } else {
        summaryEmbed.addFields({
          name: 'Список выплат',
          value: 'За прошедший период активности рекрутеров не зафиксировано.',
        });
      }

      // New week notice embed
      const nextWeekStr = this.formatRangeString(nextWeekRange.start, nextWeekRange.end);
      const newWeekEmbed = new EmbedBuilder()
        .setColor(0x10B981) // Emerald green
        .setTitle('🚀 Началась новая неделя отсчета статистики рекрутеров!')
        .setDescription(
          `📅 **Период:** с понедельника по воскресенье (**${nextWeekStr}**).\n` +
          `Все счетчики принятых заявок, отчетов и закрытых обучений обнулены.\n\n` +
          `Желаем продуктивной недели и отличных результатов! 💼`
        )
        .setFooter({ text: 'INTERPOL • Система рекрутинга и выплат' })
        .setTimestamp();

      await channel.send({
        embeds: [summaryEmbed, newWeekEmbed],
      });
    } catch (err) {
      console.error('[PayrollService] Error posting weekly announcement to Discord:', err);
    }
  }

  /**
   * Reset all recruiters' active counters without creating permanent payouts (clean slate for current week)
   */
  public static async resetActiveStats(guildId: string, executor?: { id: string; tag: string }) {
    const config = await this.getConfig(guildId);
    const now = new Date();
    const nextWeekRange = this.getWeekRange(now);

    await prisma.recruiterSalaryConfig.upsert({
      where: { guildId },
      update: {
        lastResetAt: now,
        currentWeekMonday: nextWeekRange.start,
        recruiterResetsJson: '{}',
      },
      create: {
        guildId,
        lastResetAt: now,
        currentWeekMonday: nextWeekRange.start,
        recruiterResetsJson: '{}',
      },
    });

    await AuditLogger.recordEntry({
      guildId,
      category: 'RECRUIT',
      action: 'RECRUITER_STATS_RESET_ALL',
      title: 'Обнуление текущей статистики рекрутеров',
      description: `Счетчики текущей недели обнулены администратором ${executor?.tag || 'Администратор'}.`,
      executorId: executor?.id,
      executorTag: executor?.tag,
    }).catch(() => null);

    return { success: true, resetAt: now };
  }

  /**
   * Reset stats for an individual recruiter (checkpoint)
   */
  public static async resetSingleRecruiter(guildId: string, recruiterId: string, executor?: { id: string; tag: string }) {
    const config = await this.getConfig(guildId);
    const now = new Date();

    let resets: Record<string, string> = {};
    try {
      resets = JSON.parse(config.recruiterResetsJson || '{}');
    } catch {
      resets = {};
    }
    resets[recruiterId] = now.toISOString();

    await prisma.recruiterSalaryConfig.upsert({
      where: { guildId },
      update: {
        recruiterResetsJson: JSON.stringify(resets),
      },
      create: {
        guildId,
        recruiterResetsJson: JSON.stringify(resets),
      },
    });

    await AuditLogger.recordEntry({
      guildId,
      category: 'RECRUIT',
      action: 'RECRUITER_STATS_RESET_USER',
      title: 'Индивидуальное обнуление рекрутера',
      description: `Обнулена статистика рекрутера <@${recruiterId}> с ${now.toLocaleString('ru-RU')}.`,
      executorId: executor?.id,
      executorTag: executor?.tag,
      targetId: recruiterId,
    }).catch(() => null);

    return { success: true, recruiterId, resetAt: now };
  }

  /**
   * Hide a recruiter from the payroll list entirely
   */
  public static async hideRecruiter(guildId: string, recruiterId: string, executor?: { id: string; tag: string }) {
    const config = await this.getConfig(guildId);
    let resets: Record<string, string> = {};
    try {
      resets = JSON.parse(config.recruiterResetsJson || '{}');
    } catch {
      resets = {};
    }
    resets[recruiterId] = 'HIDDEN';

    await prisma.recruiterSalaryConfig.upsert({
      where: { guildId },
      update: { recruiterResetsJson: JSON.stringify(resets) },
      create: { guildId, recruiterResetsJson: JSON.stringify(resets) },
    });

    await AuditLogger.recordEntry({
      guildId,
      category: 'RECRUIT',
      action: 'RECRUITER_HIDDEN',
      title: 'Скрыт из ведомости',
      description: `Рекрутер <@${recruiterId}> был скрыт из ведомости.`,
      executorId: executor?.id,
      executorTag: executor?.tag,
      targetId: recruiterId,
    }).catch(() => null);

    return { success: true };
  }

  /**
   * Clear reset checkpoint (revert to full week window)
   */
  public static async clearReset(guildId: string, recruiterId?: string) {
    const config = await this.getConfig(guildId);

    if (!recruiterId) {
      await prisma.recruiterSalaryConfig.upsert({
        where: { guildId },
        update: {
          lastResetAt: null,
          recruiterResetsJson: '{}',
        },
        create: {
          guildId,
          lastResetAt: null,
          recruiterResetsJson: '{}',
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

      await prisma.recruiterSalaryConfig.upsert({
        where: { guildId },
        update: {
          recruiterResetsJson: JSON.stringify(resets),
        },
        create: {
          guildId,
          recruiterResetsJson: JSON.stringify(resets),
        },
      });
      return { success: true };
    }
  }

  /**
   * Get payout history for a guild
   */
  public static async getPayoutHistory(guildId: string, options: { status?: string; limit?: number } = {}) {
    const where: any = { guildId };
    if (options.status && options.status !== 'ALL') {
      where.status = options.status;
    }

    return await prisma.recruiterPayoutRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, options.limit || 100),
    });
  }

  /**
   * Toggle or set payout record status (PAID / PENDING)
   */
  public static async updatePayoutStatus(
    guildId: string,
    payoutId: string,
    status: 'PAID' | 'PENDING',
    paidById?: string
  ) {
    const record = await prisma.recruiterPayoutRecord.findUnique({
      where: { id: payoutId },
    });

    if (!record || record.guildId !== guildId) {
      throw new Error('Запись о выплате не найдена');
    }

    return await prisma.recruiterPayoutRecord.update({
      where: { id: payoutId },
      data: {
        status,
        paidAt: status === 'PAID' ? new Date() : null,
        paidById: status === 'PAID' ? paidById : null,
      },
    });
  }

  /**
   * Delete a payout history record
   */
  public static async deletePayoutRecord(guildId: string, payoutId: string) {
    const record = await prisma.recruiterPayoutRecord.findUnique({
      where: { id: payoutId },
    });

    if (!record || record.guildId !== guildId) {
      throw new Error('Запись о выплате не найдена');
    }

    return await prisma.recruiterPayoutRecord.delete({
      where: { id: payoutId },
    });
  }

  /**
   * Generates a strict bank template for bulk payout imports in Majestic RP:
   * 
   * staticId;amount;comment
   * 265;5000;Премия
   */
  public static generateBankExport(
    records: Array<{ staticId?: string | null; totalPayout: number }>,
    comment: string = 'Премия',
    onlyPositive: boolean = true
  ): string {
    const cleanComment = (comment || 'Премия').replace(/[;\r\n]/g, ' ').trim() || 'Премия';
    const lines = ['staticId;amount;comment'];

    for (const r of records) {
      const cleanStatic = String(r.staticId || '').replace(/^#/, '').trim();
      const amount = Math.round(Number(r.totalPayout) || 0);
      if (!cleanStatic) continue;
      if (onlyPositive && amount <= 0) continue;
      lines.push(`${cleanStatic};${amount};${cleanComment}`);
    }

    return lines.join('\r\n');
  }

  /**
   * Background task: check if Monday 00:00:00 has arrived and trigger weekly rollover
   */
  public static async checkWeeklyPayrollRollover(): Promise<void> {
    const configs = await prisma.recruiterSalaryConfig.findMany({
      where: { autoWeeklyReset: true },
    });

    const now = new Date();
    const currentWeek = this.getWeekRange(now);

    for (const cfg of configs) {
      try {
        // If currentWeekMonday was never set, initialize it to this week's Monday
        if (!cfg.currentWeekMonday) {
          await prisma.recruiterSalaryConfig.update({
            where: { guildId: cfg.guildId },
            data: { currentWeekMonday: currentWeek.start },
          });
          continue;
        }

        // If the stored Monday is older than this week's Monday, a new week has started!
        if (cfg.currentWeekMonday.getTime() < currentWeek.start.getTime()) {
          console.log(`🔄 [PayrollService] New week detected for guild ${cfg.guildId}. Archiving previous week and resetting...`);
          await this.archiveAndResetWeek(cfg.guildId, { isAutomatic: true });
        }
      } catch (guildErr) {
        console.error(`[PayrollService] Error checking weekly rollover for guild ${cfg.guildId}:`, guildErr);
      }
    }
  }
}
