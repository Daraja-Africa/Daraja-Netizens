import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveEntries, type ParsedLesson, type RosterMember } from '../src/memberImport.js';

const roster: RosterMember[] = [
  { id: 'miguel', email: 'miguellewis575@gmail.com', full_name: 'Miguel Karomo' },
  { id: 'basma', email: 'issackbasma@gmail.com', full_name: 'Basma Issack Osman' },
];

function lesson(entries: ParsedLesson['entries']): ParsedLesson {
  return {
    title: 'Lesson 1 — Facilitator Training',
    date: '2026-10-13T12:00:00.000Z',
    meetingCode: 'bsx-geqp-zhu',
    sourceFile: 'lesson-1.docx',
    entries,
  };
}

test('a repeated host email does not override the attendee display name', () => {
  const resolved = resolveEntries(
    lesson([
      { displayName: 'Miguel', officialName: null, email: 'issackbasma@gmail.com', roleNote: null },
      { displayName: 'Basma Issack (Meeting host)', officialName: null, email: 'issackbasma@gmail.com', roleNote: 'Meeting host' },
    ]),
    { members: roster, aliases: new Map() }
  );

  assert.deepEqual(
    resolved.resolved.map((entry) => entry.member?.id ?? null),
    ['miguel', 'basma']
  );
});

test('the built-in alias map outranks a stored alias left by a bad import', () => {
  const resolved = resolveEntries(
    lesson([{ displayName: 'Miguel', officialName: null, email: null, roleNote: null }]),
    { members: roster, aliases: new Map([['miguel', 'issackbasma@gmail.com']]) }
  );

  assert.equal(resolved.resolved[0].member?.id, 'miguel');
});

test('a document email still identifies a member when the name does not match', () => {
  const resolved = resolveEntries(
    lesson([{ displayName: 'M. K.', officialName: null, email: 'miguellewis575@gmail.com', roleNote: null }]),
    { members: roster, aliases: new Map() }
  );

  assert.equal(resolved.resolved[0].member?.id, 'miguel');
  assert.equal(resolved.resolved[0].status, 'matched');
});
