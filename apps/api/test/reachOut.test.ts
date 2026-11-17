import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNotePatch,
  slaState,
  sortForTriage,
  summariseNotes,
  type ReachOutNote,
} from '../src/reachOut.js';

const HOUR = 3_600_000;

function note(overrides: Partial<ReachOutNote> = {}): ReachOutNote {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    reference: 'DN-ABC123',
    name: null,
    contact_method: 'whatsapp',
    contact_detail: '+254712345678',
    support_topic: 'stress-anxiety',
    urgency: 'within-24-hours',
    message: 'I have been struggling this week.',
    status: 'new',
    assigned_to: null,
    first_response_at: null,
    closed_at: null,
    created_at: '2026-11-17T08:00:00.000Z',
    ...overrides,
  };
}

test('an urgent note is overdue after 24 hours of silence', () => {
  const created = new Date('2026-11-17T08:00:00.000Z').getTime();
  assert.equal(slaState(note(), created + 23 * HOUR).overdue, false);
  const late = slaState(note(), created + 25 * HOUR);
  assert.equal(late.overdue, true);
  assert.equal(late.dueAt, '2026-11-18T08:00:00.000Z');
});

test('the clock differs by urgency', () => {
  const created = new Date('2026-11-17T08:00:00.000Z').getTime();
  const thisWeek = slaState(note({ urgency: 'this-week' }), created + 24 * HOUR);
  assert.equal(thisWeek.overdue, false);
  assert.equal(thisWeek.hoursRemaining, 6 * 24);

  const general = slaState(note({ urgency: 'general-check-in' }), created + 13 * 24 * HOUR);
  assert.equal(general.overdue, false);
});

test('first contact and closing both stop the clock', () => {
  assert.equal(slaState(note({ first_response_at: '2026-11-17T09:00:00.000Z' })).dueAt, null);
  assert.equal(slaState(note({ closed_at: '2026-11-17T09:00:00.000Z' })).dueAt, null);
});

test('replying stamps the first response and stops the clock', () => {
  const patch = buildNotePatch(note(), { status: 'in_progress' }, '2026-11-17T10:00:00.000Z');
  assert.equal(patch.status, 'in_progress');
  assert.equal(patch.first_response_at, '2026-11-17T10:00:00.000Z');
  assert.equal(patch.closed_at, null);
});

test('an existing first response is never overwritten', () => {
  const patch = buildNotePatch(
    note({ first_response_at: '2026-11-17T09:00:00.000Z' }),
    { status: 'closed' },
    '2026-11-17T18:00:00.000Z'
  );
  assert.equal(patch.status, 'closed');
  assert.equal(patch.first_response_at, undefined);
  assert.equal(patch.closed_at, '2026-11-17T18:00:00.000Z');
});

test('reopening a closed note clears the close time', () => {
  const patch = buildNotePatch(
    note({ status: 'closed', closed_at: '2026-11-17T18:00:00.000Z', first_response_at: '2026-11-17T09:00:00.000Z' }),
    { status: 'in_progress' },
    '2026-11-18T09:00:00.000Z'
  );
  assert.equal(patch.closed_at, null);
});

test('claiming a note records the owner', () => {
  const patch = buildNotePatch(note(), { assignedTo: '22222222-2222-4222-8222-222222222222' }, '2026-11-17T10:00:00.000Z');
  assert.equal(patch.assigned_to, '22222222-2222-4222-8222-222222222222');
  assert.equal(patch.status, undefined);
});

test('the summary counts what a supporter needs at a glance', () => {
  const now = new Date('2026-11-17T20:00:00.000Z').getTime();
  const summary = summariseNotes(
    [
      // Still unanswered after its 24 hour window closed.
      note({ created_at: '2026-11-16T06:00:00.000Z' }),
      note({ id: 'b', status: 'in_progress', first_response_at: '2026-11-17T09:00:00.000Z' }),
      note({ id: 'c', status: 'closed', closed_at: '2026-11-17T10:00:00.000Z' }),
      note({ id: 'd', urgency: 'general-check-in' }),
    ],
    now
  );

  assert.deepEqual(summary, { total: 4, new: 2, inProgress: 1, closed: 1, overdue: 1, urgent: 2 });
});

test('triage ordering puts new notes first, then the late ones, then the oldest', () => {
  const now = new Date('2026-11-17T20:00:00.000Z').getTime();
  const ordered = sortForTriage(
    [
      note({ id: 'closed', status: 'closed' }),
      note({ id: 'fresh', created_at: '2026-11-17T12:00:00.000Z', urgency: 'general-check-in' }),
      note({ id: 'late', created_at: '2026-11-17T08:00:00.000Z' }),
      note({ id: 'older', created_at: '2026-11-17T06:00:00.000Z' }),
    ],
    now
  );

  assert.deepEqual(
    ordered.map((item) => item.id),
    ['older', 'late', 'fresh', 'closed']
  );
});
