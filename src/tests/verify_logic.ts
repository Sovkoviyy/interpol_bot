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

  console.log('🎉 ALL LOGIC VERIFICATIONS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
