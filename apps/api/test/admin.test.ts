import assert from 'node:assert/strict';
import test from 'node:test';

import { isRosterMember, isStaff, summariseMembers } from '../src/admin.js';

const sessions = Array.from({ length: 8 }, (_, index) => ({
  id: `session-${index}`,
  title: `Lesson ${index + 1}`,
  session_type: 'online',
  scheduled_at: `2026-10-${String(index + 1).padStart(2, '0')}T12:00:00+00:00`,
  status: 'completed',
  required_for_training: true,
  required_for_stipend: index < 6,
  week_key: `week-${index + 1}`,
  is_makeup: false,
}));

function member(fullName: string, id: string) {
  return {
    id,
    full_name: fullName,
    email: `${id}@daraja.test`,
    role: 'student',
    phone: null,
    cohort: 'Cohort 1',
    member_code: id,
    status: 'active',
    created_at: null,
  };
}

function attendedFor(userId: string, count: number) {
  return sessions.slice(0, count).map((session, index) => ({
    session_id: session.id,
    user_id: userId,
    source: 'manual',
    joined_at: `2026-10-${String(index + 1).padStart(2, '0')}T12:05:00+00:00`,
  }));
}

test('a member becomes training eligible at seven of eight sessions', () => {
  const members = [member('Seven', 'seven'), member('Six', 'six')];
  const attendance = [...attendedFor('seven', 7), ...attendedFor('six', 6)];
  const [seven, six] = summariseMembers(members, sessions, attendance);

  assert.equal(seven.trainingAttended, 7);
  assert.equal(seven.trainingEligible, true);
  assert.equal(seven.attendanceRate, 88);
  assert.equal(six.trainingEligible, false);
});

test('stipend eligibility needs two thirds of the stipend sessions', () => {
  const members = [member('Four', 'four'), member('Three', 'three')];
  const attendance = [...attendedFor('four', 4), ...attendedFor('three', 3)];
  const [four, three] = summariseMembers(members, sessions, attendance);

  assert.equal(four.stipendAttended, 4);
  assert.equal(four.stipendEligible, true);
  assert.equal(three.stipendEligible, false);
});

test('attendance lists the sessions a member actually attended', () => {
  const [summary] = summariseMembers([member('One', 'one')], sessions, attendedFor('one', 2));
  assert.deepEqual(summary.attendedSessions, ['Lesson 1', 'Lesson 2']);
  assert.equal(summary.lastAttendedAt, '2026-10-02T12:05:00+00:00');
});

test('roster members and staff are told apart', () => {
  assert.equal(isRosterMember(member('Member', 'member')), true);
  assert.equal(isRosterMember({ ...member('Staff', 'staff'), role: 'facilitator', member_code: null }), false);
  assert.equal(isStaff({ role: 'admin' }), true);
  assert.equal(isStaff({ role: 'student' }), false);
});
