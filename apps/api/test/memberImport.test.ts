import assert from 'node:assert/strict';
import test from 'node:test';
import XLSX from 'xlsx';

import {
  parseMemberWorkbook,
  resolveEntries,
  roleForRosterEmail,
  type ParsedLesson,
  type RosterMember,
} from '../src/memberImport.js';

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

test('legacy pioneer and numbered cohort headings import as Cohort 1', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['NAME', 'EMAIL', 'ID No.', 'PHONE'],
      ['Alice Example', 'alice@example.com', '123', '0712345678'],
      ['Bob Example', 'bob@example.com', '456', '0798765432'],
    ]),
    'Members'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['PIONEER GROUP'],
      ['Alice Example'],
      ['COHORT 3'],
      ['Bob Example'],
    ]),
    'Cohorts'
  );

  const parsed = parseMemberWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));

  assert.deepEqual(parsed.members.map((member) => member.cohort), ['Cohort 1', 'Cohort 1']);
});

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

test('named staff imports are assigned admin while remaining roster imports are facilitators', () => {
  const named = [
    'miguellewis575@gmail.com',
    'issackbasma@gmail.com',
    'iteyokhaisia@gmail.com',
    'fellydestiny@gmail.com',
    'christellehope.ella@gmail.com',
  ];
  for (const email of named) assert.equal(roleForRosterEmail(email), 'admin');
  assert.equal(roleForRosterEmail('armstrongouma28@gmail.com'), 'facilitator');
});
