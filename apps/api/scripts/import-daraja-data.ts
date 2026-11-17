import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  applyLessonImport,
  applyMemberImport,
  defaultAliases,
  loadRoster,
  parseLessonDocument,
  parseMemberWorkbook,
  resolveEntries,
  type RosterMember,
} from '../src/memberImport.js';
import { getSupabaseClient } from '../src/supabase.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseArgs() {
  const attendance = process.argv
    .filter((arg) => arg.startsWith('--attendance='))
    .map((arg) => arg.slice('--attendance='.length))
    .filter(Boolean);
  const members = argument('--members');

  if (!members || attendance.length === 0 || process.argv.includes('--help')) {
    console.log(`Usage:
  npm run import:data --workspace @daraja/api -- \\
    --members /path/to/members.xlsx \\
    --attendance=/path/to/lesson-1.docx \\
    --attendance=/path/to/lesson-2.docx \\
    [--apply]

The default is a dry run. --apply writes members, lessons and attendance through
the service-role client. Apply the migrations in docs/data-import.md first.
`);
    process.exit(process.argv.includes('--help') ? 0 : 1);
  }

  return { members, attendance, apply: process.argv.includes('--apply') };
}

/** Offline fallback so a dry run works before Supabase is configured. */
function rosterFromWorkbook(members: ReturnType<typeof parseMemberWorkbook>['members']) {
  const roster: RosterMember[] = members.map((member, index) => ({
    id: `local-${index}`,
    email: member.email,
    full_name: member.name,
    member_code: null,
    cohort: null,
  }));
  return { members: roster, aliases: new Map<string, string>() };
}

async function main() {
  const args = parseArgs();
  const workbook = parseMemberWorkbook(await readFile(args.members));
  const lessons = await Promise.all(
    args.attendance.map(async (file) => parseLessonDocument(await readFile(file), path.basename(file)))
  );

  // A dry run should work before the attendance migrations exist, so the roster
  // is read from the database when possible and otherwise from the spreadsheet.
  let roster = rosterFromWorkbook(workbook.members);
  let rosterSource = 'spreadsheet';
  if (getSupabaseClient()) {
    try {
      roster = await loadRoster();
      rosterSource = 'database';
    } catch {
      console.warn('Reading the roster from the database failed; using the spreadsheet for this dry run.');
    }
  }

  const resolved = lessons.map((lesson) => resolveEntries(lesson, roster));
  const knownEmails = new Set(roster.members.map((member) => member.email.toLowerCase()));
  const unmatched = resolved.flatMap((lesson) =>
    lesson.resolved
      .filter((entry) => entry.status === 'unmatched' || entry.status === 'excluded')
      .map((entry) => ({ lesson: lesson.title, displayName: entry.displayName, status: entry.status }))
  );

  console.log(JSON.stringify({
    mode: args.apply ? 'apply' : 'dry-run',
    rosterSource,
    roster: {
      inFile: workbook.members.length,
      toCreate: workbook.members.filter((member) => !knownEmails.has(member.email)).length,
      toUpdate: workbook.members.filter((member) => knownEmails.has(member.email)).length,
      skipped: workbook.skipped,
    },
    lessons: resolved.map((lesson) => ({
      title: lesson.title,
      date: lesson.date.slice(0, 10),
      meetingCode: lesson.meetingCode,
      matched: lesson.resolved.filter((entry) => entry.member).length,
      unmatched: lesson.resolved.filter((entry) => entry.status === 'unmatched').length,
      excluded: lesson.resolved.filter((entry) => entry.status === 'excluded').length,
    })),
    unmatched: unmatched.map((entry) => `${entry.lesson}: ${entry.displayName} (${entry.status})`),
    aliasHints: Object.keys(defaultAliases).length,
  }, null, 2));

  if (!args.apply) return;
  const members = await applyMemberImport(workbook.members, workbook.skipped);
  const summaries = await applyLessonImport(resolved);
  console.log(JSON.stringify({ applied: { members, lessons: summaries } }, null, 2));
}

await main();
