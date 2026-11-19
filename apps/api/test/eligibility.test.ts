import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateModuleOneEligibility } from '../src/eligibility.js';

function trainingModule() {
  return Array.from({ length: 8 }, (_, index) => ({
    id: `session-${index + 1}`,
    required_for_training: true,
    // The first six sessions are also the physical sessions that carry a week.
    required_for_stipend: index < 6,
    session_type: 'physical',
    week_key: index < 6 ? `week-${index + 1}` : null,
  }));
}

function attendance(count: number, ids: string[] = []) {
  const targets = ids.length ? ids : Array.from({ length: count }, (_, index) => `session-${index + 1}`);
  return targets.map((id) => ({ meeting_id: id, presence_seconds: 60 }));
}

test('module one training eligibility uses the 7-of-8 threshold', () => {
  const result = calculateModuleOneEligibility({
    trainingSessions: trainingModule(),
    attendanceRecords: attendance(7),
  });

  assert.equal(result.requiredTraining, 8);
  assert.equal(result.trainingThreshold, 7);
  assert.equal(result.trainingEligible, true);
  assert.equal(result.trainingProgress, 88);
});

test('module one stipend eligibility uses the 4-of-6 threshold', () => {
  const result = calculateModuleOneEligibility({
    trainingSessions: trainingModule(),
    attendanceRecords: attendance(4),
  });

  assert.equal(result.requiredStipend, 6);
  assert.equal(result.stipendThreshold, 4);
  assert.equal(result.attendedStipend, 4);
  assert.equal(result.stipendEligible, true);
  assert.equal(result.stipendProgress, 67);
});

test('training boundaries: 6 is short, 7 passes, 8 is full', () => {
  const six = calculateModuleOneEligibility({ trainingSessions: trainingModule(), attendanceRecords: attendance(6) });
  assert.equal(six.trainingEligible, false);
  assert.equal(six.trainingProgress, 75);

  const seven = calculateModuleOneEligibility({ trainingSessions: trainingModule(), attendanceRecords: attendance(7) });
  assert.equal(seven.trainingEligible, true);

  const eight = calculateModuleOneEligibility({ trainingSessions: trainingModule(), attendanceRecords: attendance(8) });
  assert.equal(eight.trainingEligible, true);
  assert.equal(eight.trainingProgress, 100);
});

test('stipend boundaries: 3 is short, 4 passes, 5 still a week short of full', () => {
  const three = calculateModuleOneEligibility({ trainingSessions: trainingModule(), attendanceRecords: attendance(3) });
  assert.equal(three.stipendEligible, false);
  assert.equal(three.stipendProgress, 50);

  const four = calculateModuleOneEligibility({ trainingSessions: trainingModule(), attendanceRecords: attendance(4) });
  assert.equal(four.stipendEligible, true);

  const five = calculateModuleOneEligibility({ trainingSessions: trainingModule(), attendanceRecords: attendance(5) });
  assert.equal(five.stipendEligible, true);
  assert.equal(five.stipendProgress, 83);
});

test('a make-up session in an already-counted week does not buy a second week', () => {
  const sessions = [
    ...trainingModule(),
    { id: 'makeup-1', required_for_training: true, required_for_stipend: true, session_type: 'physical', week_key: 'week-1' },
  ];
  const records = [
    ...attendance(3),
    // Same week as session-1, sat twice.
    { meeting_id: 'makeup-1', presence_seconds: 60 },
  ];
  const result = calculateModuleOneEligibility({ trainingSessions: sessions, attendanceRecords: records });

  assert.equal(result.attendedStipend, 3, 'week-1 is one week however many sessions it holds');
  assert.equal(result.stipendEligible, false);
});

test('presence of zero does not count, and either id column matches', () => {
  const result = calculateModuleOneEligibility({
    trainingSessions: trainingModule(),
    attendanceRecords: [
      { session_id: 'session-1', presence_seconds: 60 },
      { meeting_id: 'session-2', presence_seconds: 30 },
      { session_id: 'session-3', presence_seconds: 0 },
    ],
  });

  assert.equal(result.attendedTraining, 2);
  assert.equal(result.attendanceCount, 2);
});

test('a mismatched session_id does not hide a matching meeting_id', () => {
  const result = calculateModuleOneEligibility({
    trainingSessions: trainingModule(),
    attendanceRecords: [
      { session_id: 'wrong-session', meeting_id: 'session-1', presence_seconds: 60 },
    ],
  });

  assert.equal(result.attendedTraining, 1);
});

test('an empty module never reports anyone eligible', () => {
  const result = calculateModuleOneEligibility({ trainingSessions: [], attendanceRecords: [] });

  assert.equal(result.trainingEligible, false);
  assert.equal(result.stipendEligible, false);
  assert.equal(result.trainingProgress, 0);
  assert.equal(result.stipendProgress, 0);
});
