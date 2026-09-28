import prisma from '../database/client';
import { EventService } from '../bot/modules/events/eventService';
import { EventScheduler } from '../bot/modules/events/eventScheduler';
import { MessageFlags } from 'discord.js';

async function runTest() {
  console.log('--- Testing Event Button Reliability & Concurrency ---');

  const guildId = 'test_guild_rel';
  // Ensure guild config
  await prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId },
    update: {},
  });

  // Create an active event
  const event = await prisma.eventGathering.create({
    data: {
      guildId,
      title: 'Reliability Test Event',
      type: 'LIMITED',
      participantLimit: 3,
      checkInTime: new Date(Date.now() + 600000),
      eventTime: new Date(Date.now() + 1200000),
      channelId: 'channel_123',
      createdById: 'owner_123',
      status: 'ACTIVE',
    },
  });

  console.log(`Created test event: ${event.id}`);

  // Create mock button interaction
  const createMockInteraction = (userId: string, tag: string) => {
    let deferred = false;
    let replied = false;
    let replyContent = '';
    return {
      user: { id: userId, tag },
      guildId,
      guild: null,
      deferred: false,
      replied: false,
      deferReply: async (opts: any) => {
        deferred = true;
        return opts;
      },
      reply: async (opts: any) => {
        replied = true;
        replyContent = typeof opts === 'string' ? opts : opts.content;
        return opts;
      },
      editReply: async (opts: any) => {
        replyContent = typeof opts === 'string' ? opts : opts.content;
        return opts;
      },
      getReplyContent: () => replyContent,
    } as any;
  };

  // Simulate 10 simultaneous button clicks
  console.log('Simulating 10 parallel button clicks...');
  const users = Array.from({ length: 10 }, (_, i) => ({
    id: `user_concurrent_${i + 1}`,
    tag: `UserTest#${i + 1}`,
  }));

  const interactions = users.map(u => createMockInteraction(u.id, u.tag));

  const results = await Promise.allSettled(
    interactions.map((interaction, i) => EventService.handleJoin(interaction, event.id, false))
  );

  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    console.error('Some join handlers rejected:', failures);
    process.exit(1);
  }

  // Verify DB state
  const participants = await prisma.eventParticipant.findMany({
    where: { eventId: event.id },
  });

  console.log(`Total participants registered: ${participants.length} (expected: 10)`);
  if (participants.length !== 10) {
    console.error(`Expected 10 participants, but found ${participants.length}`);
    process.exit(1);
  }

  const confirmed = participants.filter(p => p.status === 'CONFIRMED');
  const reserve = participants.filter(p => p.status === 'RESERVE');

  console.log(`Confirmed count: ${confirmed.length} (limit: 3)`);
  console.log(`Reserve count: ${reserve.length}`);

  if (confirmed.length !== 3) {
    console.error(`Expected 3 confirmed participants, got ${confirmed.length}`);
    process.exit(1);
  }
  if (reserve.length !== 7) {
    console.error(`Expected 7 reserve participants, got ${reserve.length}`);
    process.exit(1);
  }

  // Test repeat click for same user (idempotence)
  console.log('Testing repeat click for existing user...');
  const repeatInteraction = createMockInteraction(users[0].id, users[0].tag);
  await EventService.handleJoin(repeatInteraction, event.id, false);
  const repeatParticipants = await prisma.eventParticipant.findMany({
    where: { eventId: event.id },
  });
  if (repeatParticipants.length !== 10) {
    console.error('Repeat click created duplicate participant!');
    process.exit(1);
  }
  console.log('Repeat click handled correctly (no duplicates).');

  // Test leaving
  console.log('Testing participant leave with reserve promotion...');
  const leavingUser = confirmed[0];
  const leaveInteraction = createMockInteraction(leavingUser.userId, leavingUser.userTag || '');
  await EventService.handleLeave(leaveInteraction, event.id);

  const afterLeaveParticipants = await prisma.eventParticipant.findMany({
    where: { eventId: event.id },
  });
  if (afterLeaveParticipants.length !== 9) {
    console.error(`Expected 9 participants after leave, got ${afterLeaveParticipants.length}`);
    process.exit(1);
  }

  const afterConfirmed = afterLeaveParticipants.filter(p => p.status === 'CONFIRMED');
  if (afterConfirmed.length !== 3) {
    console.error(`Reserve promotion failed: expected 3 confirmed, got ${afterConfirmed.length}`);
    process.exit(1);
  }
  console.log('Leave and reserve promotion succeeded.');

  // Clean up
  await prisma.eventGathering.delete({ where: { id: event.id } });
  console.log('--- ALL EVENT RELIABILITY TESTS PASSED! ---');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test threw error:', err);
  process.exit(1);
});
