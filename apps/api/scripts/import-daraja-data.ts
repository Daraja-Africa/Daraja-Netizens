import path from 'node:path';
import process from 'node:process';

import mammoth from 'mammoth';
import XLSX from 'xlsx';

import { getSupabaseClient } from '../src/supabase.js';

type Member = {
  name: string;
  nationalId: string;
  phone: string;
  email: string;
};

type AttendanceRecord = {
  date: string;
  title: string;
  meetingCode: string;
  label: string;
};

const excludedNames = new Set(['alphonce akileng', 'fatma namanda webbo']);
const aliases: Record<string, string> = {
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
  'vicky nyohero': 'vicky nyohero',
  'zei tunie': 'olive gala enane',
};

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function display(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

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
    --attendance=/path/to/lesson-3.docx \\
    [--apply]

The default is a dry run. --apply creates inactive Auth users without invitations.
`);
    process.exit(process.argv.includes('--help') ? 0 : 1);
  }

  return { members, attendance, apply: process.argv.includes('--apply') };
}

function readMembers(filePath: string): Member[] {
  const workbook = XLSX.readFile(filePath, { cellText: true, cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rows.flatMap((row) => {
    const name = display(row.NAME ?? row['NAME ']);
    const email = display(row.EMAIL).toLowerCase();
    if (!name || !email || excludedNames.has(normalize(name))) return [];
    return [{
      name,
      nationalId: display(row['ID No.']),
      phone: display(row.PHONE ?? row['PHONE ']),
      email,
    }];
  });
}

async function readAttendance(filePath: string): Promise<AttendanceRecord[]> {
  const raw = await mammoth.extractRawText({ path: filePath });
  const lines = raw.value.split(/\r?\n/).map(display).filter(Boolean);
  const header = lines[0] ?? path.basename(filePath);
  const dateMatch = header.match(/(?:dated:\s*)?(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!dateMatch) throw new Error(`Could not find lesson date in ${filePath}`);
  const date = new Date(`${dateMatch[2]} ${dateMatch[1]}, ${dateMatch[3]} 12:00:00 UTC`).toISOString();
  const meetingCode = lines.find((line) => /^meeting code:/i.test(line))?.split(':').slice(1).join(':').trim() ?? '';
  const names: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const inline = lines[index].match(/^\d+\s+(.+)$/)?.[1];
    if (inline) {
      names.push(inline);
      continue;
    }
    if (/^\d+$/.test(lines[index]) && lines[index + 1] && !/^\d+$/.test(lines[index + 1])) {
      names.push(lines[index + 1]);
      index += 1;
    }
  }
  return names.map((label) => ({
    date,
    title: `Daraja training — ${date.slice(0, 10)}`,
    meetingCode,
    label,
  }));
}

function resolve(records: AttendanceRecord[], members: Member[]) {
  const byName = new Map(members.map((member) => [normalize(member.name), member]));
  return records.map((record) => {
    const key = normalize(record.label);
    const member = byName.get(aliases[key] ?? key);
    return { ...record, member };
  });
}

async function applyImport(members: Member[], records: ReturnType<typeof resolve>) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply');

  const users = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const authByEmail = new Map(users.data.users.flatMap((user) => user.email ? [[user.email.toLowerCase(), user.id] as const] : []));
  const userIds = new Map<string, string>();

  for (const member of members) {
    let userId = authByEmail.get(member.email);
    if (!userId) {
      const created = await supabase.auth.admin.createUser({
        email: member.email,
        email_confirm: false,
        user_metadata: { full_name: member.name, role: 'student', status: 'inactive' },
      });
      if (created.error || !created.data.user) throw created.error ?? new Error(`Unable to create ${member.email}`);
      userId = created.data.user.id;
    }
    userIds.set(member.email, userId);
    const { error } = await supabase.from('users').upsert({
      id: userId,
      email: member.email,
      full_name: member.name,
      role: 'student',
      national_id: member.nationalId,
      phone: member.phone,
      status: 'inactive',
      source: 'daraja-member-roster',
    });
    if (error) throw error;
  }

  const sessionIds = new Map<string, { sessionId: string; meetingId: string }>();
  for (const record of records) {
    if (sessionIds.has(record.date)) continue;
    const session = await supabase.from('training_sessions').upsert({
      title: record.title,
      session_type: 'online',
      scheduled_at: record.date,
      status: 'completed',
      required_for_training: true,
      required_for_stipend: false,
    }, { onConflict: 'title,scheduled_at' }).select('id').single();
    if (session.error || !session.data) throw session.error ?? new Error('Unable to create training session');
    const meeting = await supabase.from('meetings').upsert({
      room_key: `historical-${record.meetingCode}`,
      title: record.title,
      scheduled_start: record.date,
      status: 'completed',
      meeting_type: 'online',
    }, { onConflict: 'room_key' }).select('id').single();
    if (meeting.error || !meeting.data) throw meeting.error ?? new Error('Unable to create historical meeting');
    sessionIds.set(record.date, { sessionId: session.data.id, meetingId: meeting.data.id });
  }

  for (const record of records) {
    if (!record.member) continue;
    const ids = sessionIds.get(record.date);
    const userId = userIds.get(record.member.email);
    if (!ids || !userId) continue;
    const { error } = await supabase.from('attendance_logs').upsert({
      meeting_id: ids.meetingId,
      session_id: ids.sessionId,
      user_id: userId,
      joined_at: record.date,
      left_at: record.date,
      presence_seconds: 1,
      source: 'historical_import',
    }, { onConflict: 'meeting_id,user_id' });
    if (error) throw error;
  }
}

async function main() {
  const args = parseArgs();
  const members = readMembers(args.members);
  const records = (await Promise.all(args.attendance.map(readAttendance))).flat();
  const resolved = resolve(records, members);
  const unmatched = resolved.filter((record) => !record.member);

  console.log(JSON.stringify({
    mode: args.apply ? 'apply' : 'dry-run',
    activeMembers: members.length,
    excludedMembers: ['ALPHONCE AKILENG', 'Fatma Namanda Webbo'],
    lessonDates: [...new Set(records.map((record) => record.date.slice(0, 10)))],
    attendanceRows: records.length,
    matchedAttendanceRows: records.length - unmatched.length,
    unmatchedAttendanceRows: unmatched.length,
    unmatchedLabels: [...new Set(unmatched.map((record) => record.label))],
  }, null, 2));

  if (args.apply) await applyImport(members, resolved);
}

await main();
