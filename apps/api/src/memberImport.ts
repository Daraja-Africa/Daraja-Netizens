import { createHash } from 'node:crypto';

import mammoth from 'mammoth';
import XLSX from 'xlsx';

import { getSupabaseClient } from './supabase.js';

/**
 * Normalization for the facilitator roster spreadsheet and the dated lesson
 * attendance documents.
 *
 * Both the CLI importer (scripts/import-daraja-data.ts) and the facilitator Data
 * screen use these functions, so a file uploaded in the app is read exactly like
 * one imported from the terminal.
 */

export type MemberRecord = {
  name: string;
  email: string;
  nationalId: string;
  phone: string;
  cohort: string | null;
};

export type SkippedMember = { name: string; email: string; reason: string };

/** The uploaded file cannot be read as the roster/attendance document it claims to be. */
export class ImportInputError extends Error {}

export type AttendanceEntry = {
  displayName: string;
  officialName: string | null;
  email: string | null;
  roleNote: string | null;
};

export type ParsedLesson = {
  title: string;
  date: string;
  meetingCode: string;
  sourceFile: string;
  entries: AttendanceEntry[];
};

export type RosterMember = {
  id: string;
  email: string;
  full_name: string;
  member_code?: string | null;
  cohort?: string | null;
};

export type ResolutionStatus = 'matched' | 'alias' | 'unmatched' | 'excluded';

export type ResolvedEntry = AttendanceEntry & {
  status: ResolutionStatus;
  member: { id: string; email: string; full_name: string } | null;
};

export type ResolvedLesson = ParsedLesson & { resolved: ResolvedEntry[] };

/** Members the programme asked to keep out of the roster. */
export const excludedMemberKeys = ['alphonce akileng', 'fatma namanda webbo'];

/** Display names seen in the historical exports that map onto a roster member. */
export const defaultAliases: Record<string, string> = {
  'armstrong ouma': 'armstrong ouma otsyula',
  'basma issack': 'basma issack osman',
  'benedict felicity': 'felicity john benedict',
  betty: 'betty nyambura wanjiru',
  'brian milo': 'milo brian',
  'christelle hope': 'oyugi christelle hope',
  felly: 'destiny felly',
  'hope christelle': 'oyugi christelle hope',
  'hope kuria': 'gracehope wanjiku kuria',
  'hope ndanu': 'hope sila',
  ivan: 'ivan ray omondi',
  'keisha nyawira': 'keisha nyawira wahome',
  'keisha wahome': 'keisha nyawira wahome',
  'lavette noelah': 'lavette noelah onene',
  'michelle awuor': 'michelle awour',
  'elsie wanjiru': 'elsie wanjiru munge',
  miguel: 'miguel karomo',
  'mukambi soita': 'mukambi mark soita',
  'natalie akinyi': 'natalie bertha akinyi onyango',
  'natalie mwende': 'natalie mwende musyoki',
  'neema mwangi': 'neema karimi',
  'olive gala': 'olive gala enane',
  pepetual: 'pepetual muthoni wigwa',
  reson: 'hilda reson',
  'ryan gathua': 'ryan nyange',
  selina: 'selina feruzi',
  'samuel misiani': 'samuel makori misiani',
  tandy: 'tandy mariwa owino',
  whitney: 'whitney makambi',
  'zei tunie': 'olive gala enane',
};

/** Matching key: punctuation and "(You)" / "(Meeting host)" markers removed. */
export function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function displayText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/** Spreadsheet cells can hold `2.99253361E8`; restore the plain integer. */
function numberText(value: unknown): string {
  const text = displayText(value);
  return /^[\d.]+e\+?\d+$/i.test(text) ? String(Number(text)) : text;
}

/** `116103175`, `0704 019676`, `0704019676 / 0789428967` -> local 10-digit form. */
export function normalizePhone(value: unknown): string {
  return String(value ?? '')
    .split(/[/,]/)
    .map((part) => part.replace(/\D/g, ''))
    .filter(Boolean)
    .map((digits) => (digits.length === 9 ? `0${digits}` : digits))
    .join(' / ');
}

/** Stable member id, identical to `md5(email)::uuid` in the roster migration. */
export function memberIdForEmail(email: string): string {
  const hex = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function memberCodeForEmail(email: string): string {
  const local = email.split('@')[0].toLowerCase();
  return local.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').trim();
}

/** Sheet 2 spells three roster names differently from Sheet 1 (roster name -> sheet 2 spelling). */
const cohortSheetSpellings: Record<string, string> = {
  'elsie wanjiru munge': 'elsie wanjiu munge',
  'basma issack osman': 'basma isaack',
  'barrack alusa': 'barack alusa',
};

/**
 * Sheet 2 of the roster workbook groups members under a "PIONEER GROUP" or
 * "COHORT n" heading. Returns normalized name -> cohort label.
 */
function readCohorts(sheet: XLSX.WorkSheet | undefined): Map<string, string> {
  const cohorts = new Map<string, string>();
  if (!sheet) return cohorts;
  let current: string | null = null;
  for (const row of XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' })) {
    const value = displayText(row[0]);
    if (!value) continue;
    if (/^pioneer/i.test(value)) {
      current = 'Pioneer Group';
      continue;
    }
    const cohortMatch = value.match(/^cohort\s*(\d+)/i);
    if (cohortMatch) {
      current = `Cohort ${cohortMatch[1]}`;
      continue;
    }
    if (current) cohorts.set(normalizeKey(value), current);
  }
  return cohorts;
}

/** Rows of the first worksheet, excluding the header, keyed by column title. */
export function parseMemberWorkbook(buffer: Buffer): { members: MemberRecord[]; skipped: SkippedMember[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const cohorts = readCohorts(workbook.Sheets[workbook.SheetNames[1]]);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  const members: MemberRecord[] = [];
  const skipped: SkippedMember[] = [];

  for (const row of rows) {
    const name = displayText(row.NAME ?? row['NAME ']);
    const email = displayText(row.EMAIL).toLowerCase();
    if (!name && !email) continue;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      skipped.push({ name, email, reason: 'No usable email address' });
      continue;
    }
    if (excludedMemberKeys.includes(normalizeKey(name))) {
      skipped.push({ name, email, reason: 'Excluded from membership' });
      continue;
    }
    const cohortKey = cohortSheetSpellings[normalizeKey(name)] ?? normalizeKey(name);
    members.push({
      name,
      email,
      nationalId: numberText(row['ID No.']),
      phone: normalizePhone(numberText(row.PHONE ?? row['PHONE '])),
      cohort: cohorts.get(cohortKey) ?? null,
    });
  }

  return { members, skipped };
}

/**
 * Reads a lesson attendance document. Handles both shapes seen in the programme:
 * a two-column "# / Name" list, and the four-column "# / Meet display name /
 * Official member name / Email / Role" record.
 */
export async function parseLessonDocument(buffer: Buffer, sourceFile: string): Promise<ParsedLesson> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const text = htmlToText(html);
  const dateMatch = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
  if (!dateMatch) throw new ImportInputError(`${sourceFile}: no lesson date found in the document`);
  const date = new Date(`${dateMatch[2]} ${dateMatch[1]}, ${dateMatch[3]} 12:00:00 UTC`).toISOString();

  const codeMatch = text.match(/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  const meetingCode = codeMatch ? codeMatch[1].toLowerCase() : '';
  const lessonNumber = text.match(/lesson\s*(\d+)/i)?.[1];
  const title = lessonNumber
    ? `Lesson ${lessonNumber} — Facilitator Training`
    : `Training session — ${date.slice(0, 10)}`;

  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((cell) => htmlToText(cell[1]))
  );
  const header = rows.find((row) => row.some((cell) => /name/i.test(cell)));
  if (!header) throw new ImportInputError(`${sourceFile}: no attendance table found in the document`);

  const displayColumn = header.findIndex((cell) => /meet display name/i.test(cell));
  const nameColumn = displayColumn >= 0 ? displayColumn : header.findIndex((cell) => /name/i.test(cell));
  const officialColumn = header.findIndex((cell) => /official member name/i.test(cell));
  const emailColumn = header.findIndex((cell) => /email/i.test(cell));
  const noteColumn = header.findIndex((cell) => /role|status/i.test(cell));

  const entries: AttendanceEntry[] = [];
  for (const row of rows) {
    if (!/^\d+$/.test((row[0] ?? '').trim())) continue;
    const displayName = displayText(row[nameColumn]);
    if (!displayName) continue;
    const email = emailColumn >= 0 ? displayText(row[emailColumn]).toLowerCase() : '';
    entries.push({
      displayName,
      officialName: officialColumn >= 0 ? displayText(row[officialColumn]) || null : null,
      email: email && email.includes('@') ? email : null,
      roleNote: noteColumn >= 0 ? displayText(row[noteColumn]) || null : null,
    });
  }

  return { title, date, meetingCode, sourceFile, entries };
}

/** Roster plus stored aliases, used to resolve display names. */
export async function loadRoster() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase credentials are required to import members');
  // Only columns every deployment has: name resolution works before the roster
  // migration is applied, while saving an import still requires it.
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name')
    .order('full_name');
  if (error) throw migrationError(error);

  const aliases = new Map<string, string>();
  const aliasRows = await supabase.from('member_aliases').select('alias_key, member_id');
  if (!aliasRows.error) {
    const byId = new Map((data ?? []).map((row) => [row.id as string, row.email as string]));
    for (const row of aliasRows.data ?? []) {
      const email = byId.get(row.member_id as string);
      if (email) aliases.set(row.alias_key as string, email);
    }
  } else if (!isMissingTable(aliasRows.error)) {
    throw migrationError(aliasRows.error);
  }

  return { members: (data ?? []) as RosterMember[], aliases };
}

/**
 * Raised when the attendance migrations have not been applied yet, so the caller
 * can answer with instructions instead of a generic failure.
 */
export class MigrationRequiredError extends Error {
  readonly detail: string;

  constructor(detail: string) {
    super('Attendance migrations have not been applied to this database');
    this.name = 'MigrationRequiredError';
    this.detail = detail;
  }
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01' || error.code === '42703'
    || Boolean(error.message && /schema cache|does not exist/i.test(error.message));
}

function migrationError(error: { code?: string; message?: string } | null): Error {
  return isMissingTable(error)
    ? new MigrationRequiredError('Run supabase/migrations/20261117120000_attendance_import_schema.sql and the seed migrations in docs/data-import.md.')
    : new Error(error?.message ?? 'Supabase request failed');
}

export function resolveEntries(
  lesson: ParsedLesson,
  roster: { members: RosterMember[]; aliases: Map<string, string> }
): ResolvedLesson {
  const byEmail = new Map(roster.members.map((member) => [member.email.toLowerCase(), member]));
  const byName = new Map(roster.members.map((member) => [normalizeKey(member.full_name), member]));

  const resolved = lesson.entries.map((entry): ResolvedEntry => {
    const key = normalizeKey(entry.displayName);
    const byDocumentEmail = entry.email ? byEmail.get(entry.email) : undefined;
    const byOfficialName = byName.get(normalizeKey(entry.officialName ?? ''));
    // Stored aliases resolve to a member email; the built-in map lists roster names.
    const aliasTarget = roster.aliases.get(key) ?? defaultAliases[key];
    const byAlias = aliasTarget
      ? byEmail.get(aliasTarget.toLowerCase()) ?? byName.get(normalizeKey(aliasTarget))
      : undefined;
    const member = byDocumentEmail ?? byOfficialName ?? byAlias ?? byName.get(key) ?? null;

    if (member) {
      return { ...entry, status: byDocumentEmail || byOfficialName || byName.get(key) ? 'matched' : 'alias', member };
    }
    if (excludedMemberKeys.includes(key)) return { ...entry, status: 'excluded', member: null };
    return { ...entry, status: 'unmatched', member: null };
  });

  return { ...lesson, resolved };
}

/** Fails early, with the migration to run, when the import schema is missing. */
export async function assertImportSchema() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase credentials are required to import data');
  const probe = await supabase.from('users').select('member_code').limit(1);
  if (probe.error) throw migrationError(probe.error);
  const aliases = await supabase.from('member_aliases').select('id').limit(1);
  if (aliases.error) throw migrationError(aliases.error);
  return supabase;
}

export type MemberImportSummary = {
  created: string[];
  updated: string[];
  excluded: string[];
};

export async function applyMemberImport(members: MemberRecord[], skipped: SkippedMember[]): Promise<MemberImportSummary> {
  const supabase = await assertImportSchema();
  const emails = members.map((member) => member.email);
  const { data: existing, error } = await supabase.from('users').select('id, email').in('email', emails);
  if (error) throw error;
  const existingIds = new Map((existing ?? []).map((row) => [String(row.email).toLowerCase(), row.id as string]));

  const created: string[] = [];
  const updated: string[] = [];
  for (const member of members) {
    const payload = {
      email: member.email,
      full_name: member.name,
      role: 'student' as const,
      national_id: member.nationalId || null,
      phone: member.phone || null,
      cohort: member.cohort ?? null,
      member_code: memberCodeForEmail(member.email),
      status: 'active',
      source: 'daraja-member-roster',
    };
    const existingId = existingIds.get(member.email);
    if (existingId) {
      const { error: updateError } = await supabase.from('users').update(payload).eq('id', existingId);
      if (updateError) throw updateError;
      updated.push(member.name);
    } else {
      const { error: insertError } = await supabase.from('users').insert({ id: memberIdForEmail(member.email), ...payload });
      if (insertError) throw insertError;
      created.push(member.name);
    }
  }

  return { created, updated, excluded: skipped.filter((row) => row.reason === 'Excluded from membership').map((row) => row.name) };
}

export type LessonImportSummary = {
  lesson: string;
  date: string;
  attendanceWritten: number;
  unmatched: number;
};

export async function applyLessonImport(lessons: ResolvedLesson[]): Promise<LessonImportSummary[]> {
  const supabase = await assertImportSchema();
  const summaries: LessonImportSummary[] = [];

  for (const lesson of lessons) {
    const week = lesson.title.match(/lesson\s*(\d+)/i)?.[1];
    const { data: session, error: sessionError } = await supabase
      .from('training_sessions')
      .upsert(
        {
          title: lesson.title,
          session_type: 'online',
          scheduled_at: lesson.date,
          status: 'completed',
          required_for_training: true,
          required_for_stipend: false,
          week_key: week ? `week-${week}` : null,
        },
        { onConflict: 'title,scheduled_at' }
      )
      .select('id')
      .single();
    if (sessionError) throw sessionError;

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .upsert(
        {
          room_key: lesson.meetingCode || `historical-${lesson.date.slice(0, 10)}`,
          title: lesson.title,
          scheduled_start: lesson.date,
          status: 'completed',
          meeting_type: 'online',
        },
        { onConflict: 'room_key' }
      )
      .select('id')
      .single();
    if (meetingError) throw meetingError;

    // One attendance row per member: a single export can list the same person
    // twice under different display names ("Keisha Nyawira" / "Keisha Wahome").
    const matched = [
      ...new Map(lesson.resolved.filter((entry) => entry.member).map((entry) => [entry.member!.id, entry])).values(),
    ];
    const memberIds = matched.map((entry) => entry.member!.id);
    const existing = memberIds.length
      ? await supabase.from('attendance_logs').select('user_id').eq('session_id', session.id).in('user_id', memberIds)
      : { data: [], error: null };
    if (existing.error) throw existing.error;
    const alreadyLogged = new Set((existing.data ?? []).map((row) => row.user_id as string));

    const rows = matched
      .filter((entry) => !alreadyLogged.has(entry.member!.id))
      .map((entry) => ({
        meeting_id: meeting.id,
        session_id: session.id,
        user_id: entry.member!.id,
        joined_at: lesson.date,
        left_at: lesson.date,
        presence_seconds: 1,
        source: 'historical_import',
        source_label: entry.displayName,
      }));
    if (rows.length) {
      const { error: attendanceError } = await supabase.from('attendance_logs').insert(rows);
      if (attendanceError) throw attendanceError;
    }

    for (const entry of matched) {
      const aliasKey = normalizeKey(entry.displayName);
      if (aliasKey === normalizeKey(entry.member!.full_name)) continue;
      const { error: aliasError } = await supabase.from('member_aliases').upsert(
        { member_id: entry.member!.id, alias: displayText(entry.displayName), alias_key: aliasKey, source: 'import' },
        { onConflict: 'alias_key' }
      );
      if (aliasError) throw aliasError;
    }

    const unmatched = lesson.resolved.filter((entry) => entry.status === 'unmatched' || entry.status === 'excluded');
    if (unmatched.length) {
      const { error: unmatchedError } = await supabase.from('attendance_unmatched_entries').upsert(
        unmatched.map((entry) => ({
          session_id: session.id,
          display_name: entry.displayName,
          display_key: normalizeKey(entry.displayName),
          role_note: entry.roleNote,
          resolution: entry.status === 'excluded' ? 'ignored' : 'pending',
        })),
        { onConflict: 'session_id,display_key', ignoreDuplicates: true }
      );
      if (unmatchedError) throw unmatchedError;
    }

    summaries.push({
      lesson: lesson.title,
      date: lesson.date,
      attendanceWritten: rows.length,
      unmatched: unmatched.length,
    });
  }

  return summaries;
}

export type LessonOverview = {
  id: string;
  title: string;
  scheduled_at: string;
  week_key: string | null;
  meeting_code: string | null;
  attendees: Array<{ name: string; display_name: string | null; cohort: string | null }>;
  unmatched: Array<{ display_name: string; role_note: string | null; resolution: string }>;
};

/** Members, lessons and attendance for the facilitator Data screen. */
export async function getAttendanceOverview() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase credentials are required to read attendance');

  const members = await supabase
    .from('users')
    .select('id, full_name, email, phone, cohort, member_code, status')
    .not('member_code', 'is', null)
    .order('full_name');
  if (members.error) throw migrationError(members.error);

  const sessions = await supabase
    .from('training_sessions')
    .select('id, title, scheduled_at, week_key')
    .order('scheduled_at');
  if (sessions.error) throw migrationError(sessions.error);

  const sessionIds = (sessions.data ?? []).map((row) => row.id as string);
  const attendance = sessionIds.length
    ? await supabase
        .from('attendance_logs')
        .select('session_id, user_id, source_label')
        .in('session_id', sessionIds)
        .gt('presence_seconds', 0)
    : { data: [], error: null };
  if (attendance.error) throw migrationError(attendance.error);

  const unmatched = sessionIds.length
    ? await supabase
        .from('attendance_unmatched_entries')
        .select('session_id, display_name, role_note, resolution')
        .in('session_id', sessionIds)
    : { data: [], error: null };
  if (unmatched.error) throw migrationError(unmatched.error);

  const meetings = sessionIds.length
    ? await supabase.from('meetings').select('room_key, scheduled_start')
    : { data: [], error: null };
  if (meetings.error) throw migrationError(meetings.error);

  const memberById = new Map((members.data ?? []).map((row) => [row.id as string, row]));
  const lessons: LessonOverview[] = (sessions.data ?? []).map((session) => ({
    id: session.id as string,
    title: session.title as string,
    scheduled_at: session.scheduled_at as string,
    week_key: (session.week_key as string | null) ?? null,
    meeting_code: (meetings.data ?? []).find((row) => row.scheduled_start === session.scheduled_at)?.room_key ?? null,
    attendees: (attendance.data ?? [])
      .filter((row) => row.session_id === session.id)
      .map((row) => {
        const member = memberById.get(row.user_id as string);
        return {
          name: (member?.full_name as string) ?? 'Unknown member',
          display_name: (row.source_label as string | null) ?? null,
          cohort: (member?.cohort as string | null) ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    unmatched: (unmatched.data ?? [])
      .filter((row) => row.session_id === session.id)
      .map((row) => ({
        display_name: row.display_name as string,
        role_note: (row.role_note as string | null) ?? null,
        resolution: row.resolution as string,
      })),
  }));

  return {
    members: members.data ?? [],
    lessons,
    totals: {
      members: (members.data ?? []).length,
      lessons: lessons.length,
      attendance: (attendance.data ?? []).length,
      unmatched: (unmatched.data ?? []).length,
    },
    source: 'supabase' as const,
  };
}
