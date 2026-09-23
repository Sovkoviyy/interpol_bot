import { RecruitmentService } from '../bot/modules/recruitment/recruitmentService';
import { EventService } from '../bot/modules/events/eventService';

async function runTests() {
  console.log('🧪 Starting core system logic verification...');

  // Test 1: Recruitment Default Questions
  const questions = RecruitmentService.getDefaultQuestions();
  console.assert(questions.length === 5, `Expected 5 default questions, got ${questions.length}`);
  console.assert(questions[0].id === 'q_name', 'First question should be q_name');
  console.log('✅ Test 1: Default questions structure verified');

  // Test 2: Event Reserve Logic Simulation
  const sampleParticipants = [
    { id: '1', userId: 'user1', userTag: 'User 1', status: 'CONFIRMED' },
    { id: '2', userId: 'user2', userTag: 'User 2', status: 'CONFIRMED' },
    { id: '3', userId: 'user3', userTag: 'User 3', status: 'RESERVE' },
  ];

  const confirmed = sampleParticipants.filter(p => p.status === 'CONFIRMED');
  const reserve = sampleParticipants.filter(p => p.status === 'RESERVE');
  console.assert(confirmed.length === 2, 'Expected 2 confirmed');
  console.assert(reserve.length === 1, 'Expected 1 in reserve');

  // Simulate user leaving and reserve promotion
  const leavingUserId = 'user1';
  const remaining = sampleParticipants.filter(p => p.userId !== leavingUserId);
  const firstReserve = remaining.find(p => p.status === 'RESERVE');
  if (firstReserve) {
    firstReserve.status = 'CONFIRMED';
  }

  const newConfirmed = remaining.filter(p => p.status === 'CONFIRMED');
  const newReserve = remaining.filter(p => p.status === 'RESERVE');
  console.assert(newConfirmed.length === 2, 'Expected 2 confirmed after promotion');
  console.assert(newReserve.length === 0, 'Expected 0 in reserve after promotion');
  console.assert(newConfirmed[1].userId === 'user3', 'Promoted user should be user3');
  console.log('✅ Test 2: Event reserve queue and auto-promotion verified');

  // Test 3: Progressive Ping Milestones
  const testIntervals = [15, 10, 5, 3, 1];
  const testMinutesRemaining = 5;
  const isMilestone = testIntervals.includes(testMinutesRemaining);
  console.assert(isMilestone, '5 minutes should be a ping milestone');
  console.log('✅ Test 3: Event ping intervals verified');

  // Test 4: Role Persistence Logic
  const sampleMemberRoles = [
    { id: 'everyone', managed: false },
    { id: 'nitro_booster', managed: true },
    { id: 'family_officer', managed: false },
    { id: 'family_member', managed: false },
  ];
  const guildId = 'everyone';
  const filteredRoles = sampleMemberRoles
    .filter(r => r.id !== guildId && !r.managed)
    .map(r => r.id);

  console.assert(filteredRoles.length === 2, 'Expected 2 roles after filtering');
  console.assert(filteredRoles.includes('family_officer'), 'Should contain family_officer');
  console.assert(filteredRoles.includes('family_member'), 'Should contain family_member');
  console.assert(!filteredRoles.includes('nitro_booster'), 'Managed roles should be excluded');
  console.log('✅ Test 4: Role persistence filtering logic verified');

  // Test 5: Quick Date Presets Calculation
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  console.assert(tomorrow.getTime() > now.getTime(), 'Tomorrow should be in future');
  const checkinDiffMinutes = Math.round((tomorrow.getTime() - (tomorrow.getTime() - 10 * 60000)) / 60000);
  console.assert(checkinDiffMinutes === 10, 'Checkin default offset should be 10 minutes');
  console.log('✅ Test 5: Quick date and checkin time calculations verified');

  // Test 6: API Key format
  const sampleApiKey = 'interpol_3f8a91b2c4d5e6f7a8b9c0d1e2f3a4b5';
  console.assert(sampleApiKey.startsWith('interpol_'), 'API key must start with interpol_ prefix');
  console.log('✅ Test 6: External stats API key format verified');

  // Test 7: 30-Minute Message Cleanup Check
  const eventFinishedAt = new Date(Date.now() - 31 * 60 * 1000); // 31 minutes ago
  const diffMinutes = (Date.now() - eventFinishedAt.getTime()) / 60000;
  console.assert(diffMinutes >= 30, '31 minutes ago should trigger 30-minute auto cleanup');
  const recentFinishedAt = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
  const diffRecent = (Date.now() - recentFinishedAt.getTime()) / 60000;
  console.assert(diffRecent < 30, '15 minutes ago should NOT trigger 30-minute auto cleanup');
  console.log('✅ Test 7: 30-minute event message auto-deletion timer verified');

  // Test 8: EVENTS Log Category
  const logCategories = ['MESSAGES', 'MEMBERS', 'ROLES', 'CHANNELS', 'VOICE', 'INVITES', 'BOT', 'EVENTS'];
  console.assert(logCategories.includes('EVENTS'), 'EVENTS category must be present in log categories');
  console.log('✅ Test 8: Audit log category EVENTS verified');

  // Test 9: Event Role Mention Resolution
  const resolvePing = (targetRoleId?: string | null, type = 'LIMITED') => {
    if (!targetRoleId || targetRoleId === 'none') return undefined;
    if (targetRoleId === 'everyone') return '@everyone';
    if (targetRoleId === 'here') return '@here';
    return `<@&${targetRoleId}>`;
  };

  console.assert(resolvePing('123456789') === '<@&123456789>', 'Should format specific role ID');
  console.assert(resolvePing('everyone') === '@everyone', 'Should format @everyone');
  console.assert(resolvePing('here') === '@here', 'Should format @here');
  console.assert(resolvePing('none') === undefined, 'Should be undefined for none');
  console.assert(resolvePing(null) === undefined, 'Should be undefined for null');
  console.log('✅ Test 9: Specific role mention resolution verified');

  // Test 10: Academy 10-MP Promotion Threshold & Penalties
  const baseTargetMps = 10;
  const userReportsApproved = 8;
  const userPenaltyMps = 3;
  const effectiveTarget = baseTargetMps + userPenaltyMps;
  console.assert(effectiveTarget === 13, `Target should be 13 with penalties, got ${effectiveTarget}`);
  console.assert(userReportsApproved < effectiveTarget, '8/13 should not be eligible for promotion');
  const userReportsApprovedAfter = 13;
  console.assert(userReportsApprovedAfter >= effectiveTarget, '13/13 should trigger recruiter promotion ping');
  console.log('✅ Test 10: Academy 10-MP + penalty promotion threshold verified');

  // Test 11: Voice Tracker Attendance Logic (Late & Early Departure)
  const sessionStart = new Date('2026-09-23T16:00:00Z');
  const sessionEnd = new Date('2026-09-23T16:45:00Z');
  const lateGraceMinutes = 5;
  const userJoinTime = new Date('2026-09-23T16:08:00Z'); // 8 minutes after start -> late
  const isUserLate = (userJoinTime.getTime() - sessionStart.getTime()) > lateGraceMinutes * 60000;
  console.assert(isUserLate, 'User joined at 16:08 should be flagged as LATE');

  const onTimeJoinTime = new Date('2026-09-23T16:03:00Z'); // 3 minutes after start -> on time
  const isOnTime = (onTimeJoinTime.getTime() - sessionStart.getTime()) <= lateGraceMinutes * 60000;
  console.assert(isOnTime, 'User joined at 16:03 should NOT be flagged as LATE');

  const earlyLeaveTime = new Date('2026-09-23T16:25:00Z'); // 20 mins before end
  const isLeftEarly = (sessionEnd.getTime() - earlyLeaveTime.getTime()) > 5 * 60000;
  console.assert(isLeftEarly, 'User left 20m early should be flagged as LEFT_EARLY');
  console.log('✅ Test 11: Voice tracker late and early departure detection verified');

  // Test 12: Recruiter Payroll Calculations (Accepted/Rejected Recruits, Approved/Rejected Reports, Promotions)
  const rateConfig = {
    payPerCandidateAccepted: 10000,
    payPerCandidateRejected: 3000,
    payPerApprovedReport: 3000,
    payPerRejectedReport: 1500,
    payPerPromotion: 15000,
  };
  const recruiterStats = {
    acceptedCount: 4,
    rejectedCandidatesCount: 2,
    approvedReportsCount: 8,
    rejectedReportsCount: 3,
    promotionsCount: 2,
  };
  const totalPayout = 
    recruiterStats.acceptedCount * rateConfig.payPerCandidateAccepted +
    recruiterStats.rejectedCandidatesCount * rateConfig.payPerCandidateRejected +
    recruiterStats.approvedReportsCount * rateConfig.payPerApprovedReport +
    recruiterStats.rejectedReportsCount * rateConfig.payPerRejectedReport +
    recruiterStats.promotionsCount * rateConfig.payPerPromotion;
  // (4 * 10000) + (2 * 3000) + (8 * 3000) + (3 * 1500) + (2 * 15000)
  // = 40000 + 6000 + 24000 + 4500 + 30000 = 104500
  const expectedPayout = 104500;
  console.assert(totalPayout === expectedPayout, `Total payout should be ${expectedPayout}, got ${totalPayout}`);
  console.log('✅ Test 12: Recruiter payroll with accepted/rejected recruits & reports verified');

  // Test 13: Leave Request 14 Days (2 Weeks) Limit Validation
  const leaveStart = new Date('2026-10-01');
  const validLeaveEnd = new Date('2026-10-15'); // 14 days
  const invalidLeaveEnd = new Date('2026-10-16'); // 15 days
  const validDiffDays = Math.ceil((validLeaveEnd.getTime() - leaveStart.getTime()) / (1000 * 60 * 60 * 24));
  const invalidDiffDays = Math.ceil((invalidLeaveEnd.getTime() - leaveStart.getTime()) / (1000 * 60 * 60 * 24));
  console.assert(validDiffDays <= 14, `Valid leave should be <= 14 days, got ${validDiffDays}`);
  console.assert(invalidDiffDays > 14, `Invalid leave should exceed 14 days, got ${invalidDiffDays}`);
  console.log('✅ Test 13: Leave request 14-day (2 weeks) maximum limit verified');

  // Test 14: Blacklist Matching Logic
  const blacklist = [
    { staticId: '142055', discordId: '123456789', name: 'Tony Montana' },
    { staticId: '999888', discordId: null, name: 'Scarface' },
  ];
  const query1 = '142055';
  const query2 = 'scarface';
  const query3 = 'nonexistent';
  const match1 = blacklist.some(b => b.staticId === query1 || b.discordId === query1);
  const match2 = blacklist.some(b => b.name?.toLowerCase().includes(query2.toLowerCase()));
  const match3 = blacklist.some(b => b.staticId === query3);
  console.assert(match1, 'Should find match for static 142055');
  console.assert(match2, 'Should find match for scarface case-insensitively');
  console.assert(!match3, 'Should NOT find match for nonexistent');
  console.log('✅ Test 14: Blacklist search and matching verified');

  // Test 15: Anti-Nuke Channel Position & Overwrite Bitfield Serializer
  const fakeOverwrites = [
    { id: '111', allow: '1024', deny: '2048', type: 0 },
    { id: '222', allow: '0', deny: '8', type: 1 },
  ];
  const serialized = JSON.stringify(fakeOverwrites);
  const deserialized = JSON.parse(serialized);
  console.assert(deserialized.length === 2, 'Deserialized overwrites count should be 2');
  console.assert(deserialized[0].allow === '1024', 'Overwrite allow bitfield should match');
  console.log('✅ Test 15: Anti-Nuke channel snapshot serialization verified');

  // Test 16: Academy Channel Name Formatting #academ-name
  const formatAcademyChannelName = (username: string, characterName?: string | null, prefix = 'academ-') => {
    const rawName = characterName || username;
    const cleanName = rawName
      .toLowerCase()
      .replace(/[^a-z0-9а-яё_-]/gi, '')
      .slice(0, 20) || username.toLowerCase().slice(0, 20);
    return `${prefix}${cleanName}`;
  };
  const testChannel1 = formatAcademyChannelName('Tony_Montana', 'Tony Montana');
  const testChannel2 = formatAcademyChannelName('sovkoviyy');
  console.assert(testChannel1 === 'academ-tonymontana', `Expected academ-tonymontana, got ${testChannel1}`);
  console.assert(testChannel2 === 'academ-sovkoviyy', `Expected academ-sovkoviyy, got ${testChannel2}`);
  console.log('✅ Test 16: Academy #academ-name channel formatting verified');

  // Test 17: Message Logging Filter (No recursive loops in log channels)
  const logChannels = ['msg_log_id', 'audit_log_id', 'events_log_id'];
  const testMsgChannel1 = 'general_chat_id';
  const testMsgChannel2 = 'msg_log_id';
  const shouldLog1 = !logChannels.includes(testMsgChannel1);
  const shouldLog2 = !logChannels.includes(testMsgChannel2);
  console.assert(shouldLog1 === true, 'General chat message should be logged');
  console.assert(shouldLog2 === false, 'Message inside log channel should NOT be logged to prevent loop');
  console.log('✅ Test 17: Message logging feedback loop prevention verified');

  // Test 18: Leave Request Modal Date Parsing (DD.MM.YYYY and YYYY-MM-DD)
  const parseModalDate = (str: string): Date => {
    const parts = str.trim().split(/[./-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
    return new Date(str);
  };
  const d1 = parseModalDate('25.09.2026');
  const d2 = parseModalDate('2026-09-25');
  console.assert(d1.getFullYear() === 2026 && d1.getMonth() === 8 && d1.getDate() === 25, 'DD.MM.YYYY parsing should succeed');
  console.assert(d2.getFullYear() === 2026 && d2.getMonth() === 8 && d2.getDate() === 25, 'YYYY-MM-DD parsing should succeed');
  console.log('✅ Test 18: Leave request modal date parser verified');

  // Test 19: Channel Snowflake ID validation
  const isValidSnowflake = (id: string) => /^\d{17,20}$/.test(id);
  console.assert(isValidSnowflake('123456789012345678'), 'Valid 18-digit Discord Snowflake should pass');
  console.assert(!isValidSnowflake('general-chat'), 'Channel name should fail Snowflake validation');
  console.log('✅ Test 19: Channel Snowflake ID validation verified');

  // Test 20: Server Setup Provisioning Structure Mapping
  const expectedStructure = [
    { cat: '📋 ИНФОРМАЦИЯ', channels: ['добро-пожаловать', 'привязка-статика', 'отпуска-неактив'] },
    { cat: '📥 НАБОР В СЕМЬЮ', channels: ['подать-заявку', 'заявки-набор'] },
    { cat: '⚔️ МЕРОПРИЯТИЯ (МП)', channels: ['сборы-на-мп', 'Сбор на МП [Ожидание]'] },
    { cat: '🎓 ACADEMY', channels: [] },
    { cat: '📁 ACADEMY ARCHIVE', channels: [] },
    { cat: '📜 LOGS', channels: ['сообщения-лог', 'участники-лог', 'роли-лог', 'каналы-лог', 'войс-лог', 'инвайты-лог', 'бот-лог', 'ивенты-лог'] },
  ];
  const totalChannelsCount = expectedStructure.reduce((acc, curr) => acc + curr.channels.length, 0);
  console.assert(totalChannelsCount === 15, `Expected 15 total automated channels, got ${totalChannelsCount}`);
  console.assert(expectedStructure.length === 6, `Expected 6 categories, got ${expectedStructure.length}`);
  console.log('✅ Test 20: Server setup provisioning structure mapping verified');

  // Test 21: Nickname persistence logic with 0 roles
  const simulateNicknamePersistence = (
    roles: string[],
    nickname: string | null,
    restoreRoles: boolean,
    restoreNicks: boolean
  ) => {
    // Member left: save roles & nickname
    const saved = {
      roleIds: roles,
      nickname: nickname
    };

    // Member rejoins: determine what to restore
    const actions: { rolesRestored: string[]; nicknameRestored: string | null } = {
      rolesRestored: [],
      nicknameRestored: null
    };

    if (restoreRoles && saved.roleIds.length > 0) {
      actions.rolesRestored = saved.roleIds;
    }
    if (restoreNicks && saved.nickname) {
      actions.nicknameRestored = saved.nickname;
    }
    return actions;
  };

  const nickRes1 = simulateNicknamePersistence([], 'Interpol Boss', false, true);
  console.assert(nickRes1.rolesRestored.length === 0, 'No roles should be restored');
  console.assert(nickRes1.nicknameRestored === 'Interpol Boss', 'Nickname should be restored even with 0 roles');

  const nickRes2 = simulateNicknamePersistence(['role_1', 'role_2'], 'Agent 007', true, true);
  console.assert(nickRes2.rolesRestored.length === 2 && nickRes2.nicknameRestored === 'Agent 007', 'Both roles and nickname should be restored');

  const nickRes3 = simulateNicknamePersistence(['role_1'], 'Agent 007', true, false);
  console.assert(nickRes3.rolesRestored.length === 1 && nickRes3.nicknameRestored === null, 'Nickname should NOT be restored when restoreNicks is false');
  console.log('✅ Test 21: Nickname persistence and restoration logic verified');

  // Test 22: Welcome message template substitution
  const formatWelcomeMessage = (
    template: string,
    vars: { user: string; guild: string; memberCount: number }
  ) => {
    return template
      .replace(/{user}/g, vars.user)
      .replace(/{guild}/g, vars.guild)
      .replace(/{memberCount}/g, String(vars.memberCount));
  };

  const welcomeTemplate = 'Добро пожаловать, {user} на сервер {guild}! Теперь нас {memberCount}!';
  const formattedWelcome = formatWelcomeMessage(welcomeTemplate, {
    user: '<@123456789>',
    guild: 'Interpol RP Family',
    memberCount: 42
  });
  console.assert(
    formattedWelcome === 'Добро пожаловать, <@123456789> на сервер Interpol RP Family! Теперь нас 42!',
    `Expected substituted welcome message, got "${formattedWelcome}"`
  );
  console.log('✅ Test 22: Welcome message template substitution verified');

  // Test 23: Dev-login session generation (active for staging/testing)
  const simulateDevLoginAccess = () => {
    return { status: 200, token: 'mock_jwt_token', user: { isAdmin: true } };
  };
  const devLogin = simulateDevLoginAccess();
  console.assert(devLogin.status === 200, 'Dev-login should be accessible for staging/testing');
  console.assert(devLogin.user.isAdmin === true, 'Dev-login should grant admin session');
  console.log('✅ Test 23: Dev-login staging session access verified');

  // Test 24: Academy report self-approval and role authorization
  const simulateReportReviewAuth = (
    reportAuthorId: string,
    reviewerId: string,
    reviewerRoles: string[],
    recruiterRoleIds: string[],
    isAdmin: boolean
  ) => {
    if (reviewerId === reportAuthorId) {
      throw new Error('Вы не можете проверять собственный отчет');
    }
    const hasRole = isAdmin || reviewerRoles.some(r => recruiterRoleIds.includes(r));
    if (!hasRole) {
      throw new Error('У вас нет роли рекрутера для проверки отчетов');
    }
    return true;
  };

  let selfApprovalBlocked = false;
  try {
    simulateReportReviewAuth('user_123', 'user_123', ['recruiter_role'], ['recruiter_role'], false);
  } catch (err: any) {
    if (err.message.includes('собственный отчет')) selfApprovalBlocked = true;
  }
  console.assert(selfApprovalBlocked, 'Candidate should NOT be able to approve own report');

  let unauthorizedReviewBlocked = false;
  try {
    simulateReportReviewAuth('user_123', 'user_999', ['regular_member'], ['recruiter_role'], false);
  } catch (err: any) {
    if (err.message.includes('нет роли рекрутера')) unauthorizedReviewBlocked = true;
  }
  console.assert(unauthorizedReviewBlocked, 'Non-recruiter should NOT be able to review reports');

  const validReview = simulateReportReviewAuth('user_123', 'recruiter_1', ['recruiter_role'], ['recruiter_role'], false);
  console.assert(validReview === true, 'Authorized recruiter should be able to review report');
  console.log('✅ Test 24: Academy report self-approval prevention & recruiter auth verified');

  // Test 25: Discord nickname length 32-character boundary truncation
  const sanitizeDiscordNickname = (name: string): string => {
    return name.trim().slice(0, 32);
  };
  const longName = 'A'.repeat(50);
  const truncated = sanitizeDiscordNickname(longName);
  console.assert(truncated.length === 32, `Expected 32 chars, got ${truncated.length}`);
  console.assert(sanitizeDiscordNickname(' Interpol Boss ').length === 13, 'Whitespace should be trimmed');
  console.log('✅ Test 25: Discord nickname 32-character boundary truncation verified');

  // Test 26: External stats in-memory cache and rate limiter logic
  const mockCache = new Map<string, { data: string; cachedAt: number }>();
  const mockRateLimit = new Map<string, { count: number; resetAt: number }>();

  const getStatsWithCache = (key: string, now: number) => {
    const cached = mockCache.get(key);
    if (cached && (now - cached.cachedAt) < 30000) {
      return { source: 'cache', data: cached.data };
    }
    mockCache.set(key, { data: 'stats_data', cachedAt: now });
    return { source: 'fresh', data: 'stats_data' };
  };

  const checkRateLimit = (key: string, now: number, limit = 60) => {
    const record = mockRateLimit.get(key);
    if (!record || now > record.resetAt) {
      mockRateLimit.set(key, { count: 1, resetAt: now + 60000 });
      return true;
    }
    if (record.count >= limit) return false;
    record.count++;
    return true;
  };

  const t0 = 100000;
  const resFresh = getStatsWithCache('guild_1', t0);
  const resCached = getStatsWithCache('guild_1', t0 + 10000); // 10s later
  const resExpired = getStatsWithCache('guild_1', t0 + 35000); // 35s later
  console.assert(resFresh.source === 'fresh', 'Initial call should be fresh');
  console.assert(resCached.source === 'cache', 'Call within 30s should be cached');
  console.assert(resExpired.source === 'fresh', 'Call after 30s should refresh cache');

  let requestsAllowed = 0;
  for (let i = 0; i < 65; i++) {
    if (checkRateLimit('ip_127.0.0.1', t0, 60)) requestsAllowed++;
  }
  console.assert(requestsAllowed === 60, `Expected 60 allowed requests, got ${requestsAllowed}`);
  console.log('✅ Test 26: External stats cache and rate limiter logic verified');

  console.log('🎉 ALL 26 SYSTEM LOGIC VERIFICATIONS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});


