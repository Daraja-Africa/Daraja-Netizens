import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateModuleOneEligibility } from '../src/supabase.js';

test('module one training eligibility uses the 7-of-8 threshold', () => {
  const result = calculateModuleOneEligibility({
    trainingSessions: Array.from({ length: 8 }, (_, index) => ({
      id: `session-${index + 1}`,
      required_for_training: true,
      required_for_stipend: index < 6,
    })),
    attendanceRecords: Array.from({ length: 7 }, (_, index) => ({
      meeting_id: `session-${index + 1}`,
      presence_seconds: 60,
    })),
  });

  assert.equal(result.requiredTraining, 8);
  assert.equal(result.trainingThreshold, 7);
  assert.equal(result.trainingEligible, true);
  assert.equal(result.trainingProgress, 88);
});

test('module one stipend eligibility uses the 4-of-6 threshold', () => {
  const result = calculateModuleOneEligibility({
    trainingSessions: Array.from({ length: 6 }, (_, index) => ({
      id: `stipend-${index + 1}`,
      required_for_training: false,
      required_for_stipend: true,
    })),
    attendanceRecords: Array.from({ length: 4 }, (_, index) => ({
      meeting_id: `stipend-${index + 1}`,
      presence_seconds: 60,
    })),
  });

  assert.equal(result.requiredStipend, 6);
  assert.equal(result.stipendThreshold, 4);
  assert.equal(result.stipendEligible, true);
  assert.equal(result.stipendProgress, 67);
});
