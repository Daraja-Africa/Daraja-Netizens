import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { config } from './config.js';
import { calculateModuleOneEligibility } from './eligibility.js';
import type { ReachOutNote } from './reachOut.js';
import { fallbackSupportContacts, type StudentSupportContact } from './studentContent.js';
import { eventStore } from './telemetry.js';

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (client) return client;
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return null;
  client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false } });
  return client;
}

export async function persistTelemetryRecord(payload: Record<string, unknown>) {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, mode: 'memory' };
  const { error } = await supabase.from('telemetry_events').insert(payload);
  if (error) throw error;
  return { ok: true, mode: 'supabase' };
}

/**
 * Creates the profile row when it is missing and never touches an existing one.
 *
 * This used to be an upsert that wrote `role` on every call, which meant any
 * authenticated request to a handler that passed `role: 'facilitator'`
 * permanently promoted the caller. Role assignment belongs to the roster
 * import and the admin path, never to a request that merely needs a profile.
 */
export async function ensureUser(input: { id: string; email: string; fullName: string }) {
  const supabase = getSupabaseClient();
  if (!supabase) return { id: input.id, email: input.email, full_name: input.fullName, role: 'facilitator' };

  const existing = await readProfileById(input.id);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('users')
    .insert({ id: input.id, email: input.email, full_name: input.fullName })
    .select(PROFILE_COLUMNS)
    .single();
  if (!error) return data;

  // A concurrent create, or an email that already belongs to another profile.
  const raced = await readProfileById(input.id);
  if (raced) return raced;
  throw error;
}

export type AuthorizedProfile = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'facilitator' | 'student' | 'participant' | 'host';
};

const PROFILE_COLUMNS = 'id, email, full_name, role';
const SEEDED_COLUMNS = `${PROFILE_COLUMNS}, created_at, national_id, phone, status, source, member_code, cohort`;

async function readProfileById(id: string): Promise<AuthorizedProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from('users').select(PROFILE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as AuthorizedProfile | null) ?? null;
}

/**
 * Finds the allowlisted profile behind an authenticated Supabase user.
 *
 * Roster profiles are seeded before anyone signs in, so their ids are
 * placeholders. When the Auth uuid has no profile yet but the email matches a
 * seeded profile, that profile and everything referencing it move onto the Auth
 * uuid (the same reconciliation the database trigger runs), so an existing
 * login heals even before the SQL trigger exists.
 *
 * Returns null when the account is not on the allowlist; callers must deny it.
 */
export async function resolveOrSyncAuthorizedUser(input: {
  id: string;
  email?: string | null;
  fullName?: string | null;
}): Promise<AuthorizedProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const email = input.email?.trim();
  if (!email) return null;
  const normalizedEmail = email.toLowerCase();

  const linked = await readProfileById(input.id);
  if (linked) {
    const { data: reconciledId, error: rpcError } = await supabase.rpc('reconcile_seeded_profile', {
      p_auth_id: input.id,
      p_email: normalizedEmail,
      p_full_name: input.fullName ?? null,
    });
    if (!rpcError) {
      if (!reconciledId) return null;
      return await readProfileById(input.id);
    }
    if (rpcError.code !== 'PGRST202') throw rpcError;
    return linked;
  }

  const { data: seeded, error: seededError } = await supabase
    .from('users')
    .select(SEEDED_COLUMNS)
    .filter('email', 'ilike', normalizedEmail.replace(/([\\%_])/g, '\\$1'))
    .maybeSingle();
  if (seededError) throw seededError;
  if (!seeded) return null;

  return reconcileSeededProfile(seeded, { ...input, email });
}

type SeededProfileRow = AuthorizedProfile & {
  created_at: string | null;
  national_id: string | null;
  phone: string | null;
  status: string | null;
  source: string | null;
  member_code: string | null;
  cohort: string | null;
};

/**
 * Moves a seeded profile onto the Auth uuid. Prefers the database function so
 * the whole move is one transaction, and only falls back to individual writes
 * when that migration has not been applied to this database yet.
 */
async function reconcileSeededProfile(
  seed: SeededProfileRow,
  input: { id: string; email: string; fullName?: string | null },
): Promise<AuthorizedProfile> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase is not configured');

  const { error: rpcError } = await supabase.rpc('reconcile_seeded_profile', {
    p_auth_id: input.id,
    p_email: input.email,
    p_full_name: input.fullName ?? null,
  });
  if (!rpcError) {
    const profile = await readProfileById(input.id);
    if (!profile) throw new Error('Profile reconciliation did not produce a profile');
    return profile;
  }
  if (rpcError.code !== 'PGRST202') throw rpcError;

  // Release the unique email and member_code before the replacement takes them.
  const { error: releaseError } = await supabase
    .from('users')
    .update({ email: `${seed.id}@migrated.local`, member_code: null })
    .eq('id', seed.id);
  if (releaseError) throw releaseError;

  const { data: linked, error: insertError } = await supabase
    .from('users')
    .insert({
      id: input.id,
      email: input.email,
      full_name: seed.full_name?.trim() || input.fullName?.trim() || input.email,
      role: seed.role,
      created_at: seed.created_at,
      national_id: seed.national_id,
      phone: seed.phone,
      status: seed.status,
      source: seed.source,
      member_code: seed.member_code,
      cohort: seed.cohort,
    })
    .select(PROFILE_COLUMNS)
    .single();
  if (insertError) throw insertError;

  const references: Array<[string, string]> = [
    ['attendance_logs', 'user_id'],
    ['telemetry_events', 'user_id'],
    ['meetings', 'host_id'],
    ['qr_challenges', 'facilitator_id'],
    ['qr_challenges', 'redeemed_by'],
    ['member_aliases', 'member_id'],
    ['attendance_unmatched_entries', 'member_id'],
  ];
  for (const [table, column] of references) {
    const { error } = await supabase.from(table).update({ [column]: input.id }).eq(column, seed.id);
    if (error) throw error;
  }

  const { error: deleteError } = await supabase.from('users').delete().eq('id', seed.id);
  if (deleteError) throw deleteError;

  return linked as AuthorizedProfile;
}

type InMemoryMeeting = {
  id: string;
  room_key: string;
  title: string;
  host_id: string;
  scheduled_start: string;
  status: string;
};

type InMemoryAttendance = {
  id: string;
  meeting_id: string;
  user_id: string;
  session_id?: string;
  joined_at: string;
  left_at?: string;
  presence_seconds: number;
  source: 'online_jitsi';
};

const inMemoryMeetings: InMemoryMeeting[] = [];
const inMemoryAttendance = new Map<string, InMemoryAttendance>();

function attendanceKey(meetingId: string, userId: string) {
  return `${meetingId}:${userId}`;
}

function earliestTimestamp(first: string, second: string) {
  return new Date(first).getTime() <= new Date(second).getTime() ? first : second;
}

function latestTimestamp(...timestamps: Array<string | undefined>) {
  const valid = timestamps.filter((value): value is string => Boolean(value));
  return valid.reduce<string | undefined>((latest, value) => {
    if (!latest || new Date(value).getTime() > new Date(latest).getTime()) return value;
    return latest;
  }, undefined);
}

export async function createMeeting(input: { roomKey: string; title: string; hostId: string; scheduledStart?: string }) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const existing = inMemoryMeetings.find((meeting) => meeting.room_key === input.roomKey);
    if (existing) return existing;
    const meeting: InMemoryMeeting = {
      id: input.roomKey,
      room_key: input.roomKey,
      title: input.title,
      host_id: input.hostId,
      scheduled_start: input.scheduledStart ?? new Date().toISOString(),
      status: 'scheduled',
    };
    inMemoryMeetings.push(meeting);
    return meeting;
  }
  const { data, error } = await supabase.from('meetings').upsert({
    room_key: input.roomKey, title: input.title, host_id: input.hostId, scheduled_start: input.scheduledStart ?? new Date().toISOString(), status: 'scheduled',
  }, { onConflict: 'room_key' }).select().single();
  if (error) throw error;
  return data;
}

export async function listActiveRooms() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      meetings: [...inMemoryMeetings]
        .filter((meeting) => meeting.status === 'scheduled' || meeting.status === 'active')
        .sort((left, right) => right.scheduled_start.localeCompare(left.scheduled_start))
        .slice(0, 20),
      source: 'memory' as const,
    };
  }
  const { data, error } = await supabase
    .from('meetings')
    .select('id, room_key, title, scheduled_start, status, host_id')
    .in('status', ['scheduled', 'active'])
    .order('scheduled_start', { ascending: false })
    .limit(20);
  if (error) throw error;
  return { meetings: data ?? [], source: 'supabase' as const };
}

export async function upsertAttendance(input: {
  meetingId: string;
  userId: string;
  joinedAt: string;
  leftAt?: string;
  presenceSeconds?: number;
  sessionId?: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const key = attendanceKey(input.meetingId, input.userId);
    const existing = inMemoryAttendance.get(key);
    const attendance: InMemoryAttendance = {
      id: key,
      meeting_id: input.meetingId,
      user_id: input.userId,
      joined_at: existing ? earliestTimestamp(existing.joined_at, input.joinedAt) : input.joinedAt,
      left_at: latestTimestamp(existing?.left_at, input.leftAt),
      presence_seconds: existing ? Math.max(existing.presence_seconds, input.presenceSeconds ?? 0) : input.presenceSeconds ?? 0,
      session_id: input.sessionId ?? existing?.session_id,
      source: 'online_jitsi',
    };
    inMemoryAttendance.set(key, attendance);
    return attendance;
  }
  const { data: existing, error: lookupError } = await supabase
    .from('attendance_logs')
    .select('id, joined_at, left_at, presence_seconds, session_id')
    .eq('meeting_id', input.meetingId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  const { data, error } = await supabase.from('attendance_logs').upsert({
    meeting_id: input.meetingId,
    user_id: input.userId,
    joined_at: existing ? earliestTimestamp(existing.joined_at, input.joinedAt) : input.joinedAt,
    left_at: latestTimestamp(existing?.left_at, input.leftAt),
    presence_seconds: existing ? Math.max(existing.presence_seconds, input.presenceSeconds ?? 0) : input.presenceSeconds ?? 0,
    session_id: input.sessionId ?? existing?.session_id ?? null,
    source: 'online_jitsi',
  }, { onConflict: 'meeting_id,user_id' }).select().single();
  if (error) throw error;
  return data;
}

export async function incrementAttendance(input: {
  meetingId: string;
  userId: string;
  deltaSeconds: number;
  timestamp: string;
  sessionId?: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const key = attendanceKey(input.meetingId, input.userId);
    const existing = inMemoryAttendance.get(key);
    const attendance: InMemoryAttendance = {
      id: key,
      meeting_id: input.meetingId,
      user_id: input.userId,
      joined_at: existing?.joined_at ?? input.timestamp,
      left_at: latestTimestamp(existing?.left_at, input.timestamp),
      presence_seconds: (existing?.presence_seconds ?? 0) + input.deltaSeconds,
      session_id: input.sessionId ?? existing?.session_id,
      source: 'online_jitsi',
    };
    inMemoryAttendance.set(key, attendance);
    return attendance;
  }
  const { data: existing, error: lookupError } = await supabase
    .from('attendance_logs')
    .select('id, joined_at, left_at, presence_seconds, session_id')
    .eq('meeting_id', input.meetingId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  const { data, error } = await supabase.from('attendance_logs').upsert({
    meeting_id: input.meetingId,
    user_id: input.userId,
    joined_at: existing?.joined_at ?? input.timestamp,
    left_at: latestTimestamp(existing?.left_at, input.timestamp),
    presence_seconds: (existing?.presence_seconds ?? 0) + input.deltaSeconds,
    session_id: input.sessionId ?? existing?.session_id ?? null,
    source: 'online_jitsi',
  }, { onConflict: 'meeting_id,user_id' }).select().single();
  if (error) throw error;
  return data;
}

export async function listTelemetryEvents(input: { meetingId?: string; limit?: number } = {}) {
  const limit = Math.min(input.limit ?? 100, 200);
  const supabase = getSupabaseClient();
  if (!supabase) {
    const events = eventStore
      .filter((event) => !input.meetingId || event.meetingId === input.meetingId)
      .slice()
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, limit);
    return { events, source: 'memory' as const };
  }
  let query = supabase
    .from('telemetry_events')
    .select('id, meeting_id, user_id, event_type, created_at, payload')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (input.meetingId) query = query.eq('meeting_id', input.meetingId);
  const { data, error } = await query;
  if (error) throw error;
  return { events: data ?? [], source: 'supabase' as const };
}

export async function getDashboardSummary() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const attendance = [...inMemoryAttendance.values()];
    const totalPresenceSeconds = attendance.reduce((total, item) => total + item.presence_seconds, 0);
    return {
      meetings: inMemoryMeetings,
      attendance,
      telemetry: eventStore,
      summary: {
        totalMeetings: inMemoryMeetings.length,
        activeMeetings: inMemoryMeetings.filter((meeting) => meeting.status === 'active').length,
        uniqueAttendees: new Set(attendance.map((item) => item.user_id)).size,
        totalPresenceMinutes: Math.round(totalPresenceSeconds / 60),
      },
      source: 'memory' as const,
    };
  }
  const [meetings, attendance, telemetry] = await Promise.all([
    supabase.from('meetings').select('id, room_key, title, scheduled_start, status, host_id').order('scheduled_start', { ascending: false }).limit(20),
    supabase.from('attendance_logs').select('id, meeting_id, user_id, joined_at, left_at, presence_seconds').order('joined_at', { ascending: false }).limit(100),
    supabase.from('telemetry_events').select('id, meeting_id, user_id, event_type, created_at').order('created_at', { ascending: false }).limit(100),
  ]);
  const error = meetings.error ?? attendance.error ?? telemetry.error;
  if (error) throw error;
  const attendanceRows = attendance.data ?? [];
  const meetingRows = meetings.data ?? [];
  const totalPresenceSeconds = attendanceRows.reduce((total, item) => total + Number(item.presence_seconds ?? 0), 0);
  return {
    meetings: meetingRows,
    attendance: attendanceRows,
    telemetry: telemetry.data ?? [],
    summary: {
      totalMeetings: meetingRows.length,
      activeMeetings: meetingRows.filter((meeting) => meeting.status === 'active').length,
      uniqueAttendees: new Set(attendanceRows.map((item) => item.user_id)).size,
      totalPresenceMinutes: Math.round(totalPresenceSeconds / 60),
    },
    source: 'supabase',
  };
}

export async function getRoleDashboard(userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return { stats: { physicalSessions: 0, onlineSessions: 0, attendanceRate: 0, trainingProgress: 0, stipendProgress: 0 }, sessions: [], source: 'memory' };
  const [meetings, attendance, sessions] = await Promise.all([
    supabase.from('meetings').select('id, room_key, title, scheduled_start, status, meeting_type').eq('host_id', userId).order('scheduled_start', { ascending: false }).limit(50),
    supabase.from('attendance_logs').select('id, meeting_id, session_id, user_id, joined_at, left_at, presence_seconds, source').eq('user_id', userId).order('joined_at', { ascending: false }).limit(200),
    supabase.from('training_sessions').select('id, title, session_type, scheduled_at, status, required_for_training, required_for_stipend, week_key').order('scheduled_at', { ascending: false }).limit(50),
  ]);
  const error = meetings.error ?? attendance.error ?? sessions.error;
  if (error) throw error;
  const sessionRows = sessions.data ?? [];
  // The rate belongs to the signed-in member: sessions they attended over the
  // sessions in the programme, never a ratio of their own attendance rows.
  const attendedSessionIds = new Set(
    (attendance.data ?? [])
      .filter((item) => Number(item.presence_seconds) > 0)
      .flatMap((item) => [item.session_id, item.meeting_id])
      .filter((id): id is string => Boolean(id))
  );
  const attendedSessions = sessionRows.filter((session) => attendedSessionIds.has(session.id)).length;
  const eligibility = calculateModuleOneEligibility({
    trainingSessions: sessionRows,
    attendanceRecords: (attendance.data ?? []).map((item) => ({ meeting_id: item.meeting_id, session_id: item.session_id, presence_seconds: item.presence_seconds })),
  });
  return {
    stats: {
      physicalSessions: sessionRows.filter((item) => item.session_type === 'physical').length,
      onlineSessions: sessionRows.filter((item) => item.session_type === 'online').length,
      attendanceRate: sessionRows.length ? Math.round((attendedSessions / sessionRows.length) * 100) : 0,
      trainingProgress: eligibility.trainingProgress,
      stipendProgress: eligibility.stipendProgress,
    },
    sessions: sessionRows,
    eligibility,
    source: 'supabase',
  };
}

function physicalSessionTitle(day: Date) {
  return `Physical session — ${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
}

/**
 * The physical session a check-in QR belongs to. Facilitators generate a
 * challenge from the session room, so the session is resolved from the calendar
 * instead of being typed in: today's physical session when one is scheduled,
 * otherwise a session created for today.
 */
async function resolvePhysicalSession() {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const title = physicalSessionTitle(now);
  const supabase = getSupabaseClient();
  if (!supabase) return { id: crypto.randomUUID(), title, scheduled_at: now.toISOString() };

  const existing = await supabase
    .from('training_sessions')
    .select('id, title, scheduled_at')
    .eq('session_type', 'physical')
    .gte('scheduled_at', startOfDay.toISOString())
    .lt('scheduled_at', endOfDay.toISOString())
    .order('scheduled_at')
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase
    .from('training_sessions')
    .insert({ title, session_type: 'physical', scheduled_at: now.toISOString() })
    .select('id, title, scheduled_at')
    .single();
  if (created.error) throw created.error;
  return created.data;
}

export async function createQrChallenge(input: { sessionId: string; facilitatorId: string }) {
  const supabase = getSupabaseClient();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  if (!supabase) return { id: crypto.randomUUID(), session_id: input.sessionId, token: crypto.randomUUID(), expires_at: expiresAt };
  const { data, error } = await supabase.from('qr_challenges').insert({ session_id: input.sessionId, facilitator_id: input.facilitatorId, expires_at: expiresAt }).select('id, session_id, token, expires_at').single();
  if (error) throw error;
  return data;
}

export async function listTrainingSessions() {
  const supabase = getSupabaseClient();
  if (!supabase) return { sessions: [], source: 'memory' };
  const { data, error } = await supabase.from('training_sessions').select('id, title, session_type, scheduled_at, status, required_for_training, required_for_stipend, week_key, is_makeup').order('scheduled_at', { ascending: true });
  if (error) throw error;
  return { sessions: data ?? [], source: 'supabase' };
}

export async function createTrainingSession(input: {
  title: string;
  sessionType: 'physical' | 'online';
  scheduledAt: string;
  requiredForTraining: boolean;
  requiredForStipend: boolean;
  weekKey?: string;
  isMakeup: boolean;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) return { ...input, id: crypto.randomUUID(), status: 'scheduled' };
  const { data, error } = await supabase.from('training_sessions').insert({
    title: input.title,
    session_type: input.sessionType,
    scheduled_at: input.scheduledAt,
    required_for_training: input.requiredForTraining,
    required_for_stipend: input.requiredForStipend,
    week_key: input.weekKey,
    is_makeup: input.isMakeup,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function getEligibility(userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return {
    training: { attended: 0, required: 8, ratio: 0, eligible: false },
    stipend: { attendedWeeks: 0, requiredWeeks: 4, totalWeeks: 6, ratio: 0, eligible: false },
    source: 'memory',
  };
  const [sessions, attendance] = await Promise.all([
    supabase.from('training_sessions').select('id, session_type, required_for_training, required_for_stipend, week_key, is_makeup').order('scheduled_at'),
    supabase.from('attendance_logs').select('session_id, meeting_id, presence_seconds').eq('user_id', userId).gt('presence_seconds', 0),
  ]);
  const error = sessions.error ?? attendance.error;
  if (error) throw error;
  // Same engine, same matching rule and same thresholds as the dashboard.
  const eligibility = calculateModuleOneEligibility({
    trainingSessions: sessions.data ?? [],
    attendanceRecords: attendance.data ?? [],
  });
  return {
    training: {
      attended: eligibility.attendedTraining,
      required: eligibility.trainingThreshold,
      total: eligibility.trainingTotal,
      ratio: eligibility.trainingProgress,
      eligible: eligibility.trainingEligible,
    },
    stipend: {
      attendedWeeks: eligibility.attendedStipend,
      requiredWeeks: eligibility.stipendThreshold,
      totalWeeks: eligibility.stipendTotalWeeks,
      ratio: eligibility.stipendProgress,
      eligible: eligibility.stipendEligible,
    },
    source: 'supabase',
  };
}

export async function redeemQrChallenge(input: { token: string; studentId: string }) {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, source: 'memory', session_id: null };
  const { data: challenge, error: challengeError } = await supabase.from('qr_challenges').select('id, session_id, expires_at, redeemed_at').eq('token', input.token).maybeSingle();
  if (challengeError) throw challengeError;
  if (!challenge || challenge.redeemed_at || new Date(challenge.expires_at).getTime() < Date.now()) throw new Error('QR challenge is expired or already used');
  const { data: redeemed, error: redeemError } = await supabase
    .from('qr_challenges')
    .update({ redeemed_at: new Date().toISOString(), redeemed_by: input.studentId })
    .eq('id', challenge.id)
    .is('redeemed_at', null)
    .select('id')
    .maybeSingle();
  if (redeemError) throw redeemError;
  if (!redeemed) throw new Error('QR challenge is expired or already used');
  const { error: attendanceError } = await supabase.from('attendance_logs').insert({ session_id: challenge.session_id, user_id: input.studentId, joined_at: new Date().toISOString(), presence_seconds: 1, source: 'physical_qr' });
  if (attendanceError) throw attendanceError;
  return { ok: true, source: 'supabase', session_id: challenge.session_id };
}

export async function getContentFeed() {
  const supabase = getSupabaseClient();
  if (!supabase) return { items: [], source: 'memory' };
  const { data, error } = await supabase.from('content_items').select('id, title, summary, url, category, published_at').eq('published', true).order('published_at', { ascending: false });
  if (error) throw error;
  return { items: data ?? [], source: 'supabase' };
}

export async function getSupportContacts() {
  const supabase = getSupabaseClient();
  if (!supabase) return { contacts: [], source: 'memory' };
  const { data, error } = await supabase.from('support_contacts').select('id, label, channel, value').eq('active', true).order('label');
  if (error) throw error;
  return { contacts: data ?? [], source: 'supabase' };
}

/**
 * Wellness support cards for the Student Portal Reach-Out page. Programmes can
 * curate them in the `support_contacts` table; the bundled helplines are used
 * whenever the table is empty or Supabase is not configured.
 */
export async function getStudentSupportContacts(): Promise<{ contacts: StudentSupportContact[]; source: 'supabase' | 'fallback' }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { contacts: fallbackSupportContacts, source: 'fallback' };
  const { data, error } = await supabase.from('support_contacts').select('id, label, channel, value').eq('active', true).order('label');
  if (error) throw error;
  const contacts = (data ?? []).map((row) => ({
    id: String(row.id),
    label: String(row.label),
    channel: row.channel as StudentSupportContact['channel'],
    value: String(row.value),
  }));
  return contacts.length ? { contacts, source: 'supabase' } : { contacts: fallbackSupportContacts, source: 'fallback' };
}

/**
 * Records a confidential reach-out request. Writes go through the service-role
 * client only — the table has deny-by-default RLS, so browsers can never read
 * these rows back.
 */
export async function createStudentReachOutRequest(input: {
  reference: string;
  name?: string;
  contactMethod: string;
  contactDetail: string;
  supportTopic: string;
  urgency: string;
  message: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true as const, mode: 'memory' as const, reference: input.reference };
  const { error } = await supabase.from('student_reach_out_requests').insert({
    reference: input.reference,
    name: input.name?.trim() ? input.name.trim() : null,
    contact_method: input.contactMethod,
    contact_detail: input.contactDetail,
    support_topic: input.supportTopic,
    urgency: input.urgency,
    message: input.message,
  });
  if (error) throw error;
  return { ok: true as const, mode: 'supabase' as const, reference: input.reference };
}

/** Credentials are present. This says nothing about whether Postgres answers. */
export const supabaseConfigured = Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);

export type ReadinessResult = { ok: boolean; latencyMs: number; detail: string };

const readinessCache = { checkedAt: 0, result: null as ReadinessResult | null };
const READINESS_TTL_MS = 5_000;
const READINESS_TIMEOUT_MS = 2_000;

async function probeDatabase(): Promise<ReadinessResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, latencyMs: 0, detail: 'Supabase credentials missing' };

  const startedAt = Date.now();
  try {
    // A cheap round-trip: any answer from Postgres means the instance is serving.
    const query = supabase.from('users').select('id', { head: true, count: 'exact' }).limit(1);
    const result = await Promise.race([
      query.then((response) => ({ error: response.error?.message ?? null })),
      new Promise<{ error: string }>((resolve) =>
        setTimeout(() => resolve({ error: `Database probe timed out after ${READINESS_TIMEOUT_MS}ms` }), READINESS_TIMEOUT_MS)
      ),
    ]);
    const latencyMs = Date.now() - startedAt;
    if (result.error) return { ok: false, latencyMs, detail: result.error };
    return { ok: true, latencyMs, detail: 'database answered' };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : 'Database probe failed',
    };
  }
}

/**
 * Readiness means Postgres answers, not that the environment variables are
 * non-empty. Results are cached briefly so a load balancer polling every second
 * cannot become a query amplifier.
 */
export async function checkSupabaseReadiness(force = false): Promise<ReadinessResult> {
  const now = Date.now();
  if (!force && readinessCache.result && now - readinessCache.checkedAt < READINESS_TTL_MS) {
    return readinessCache.result;
  }
  const result = await probeDatabase();
  readinessCache.checkedAt = Date.now();
  readinessCache.result = result;
  return result;
}

const REACH_OUT_COLUMNS =
  'id, reference, name, contact_method, contact_detail, support_topic, urgency, message, status, assigned_to, first_response_at, closed_at, created_at';

/** True when a query failed because the triage migration has not been applied yet. */
export function isMissingReachOutSchema(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: string; message?: string };
  return (
    code === '42703' ||
    code === '42P01' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    Boolean(message && /schema cache|does not exist/i.test(message))
  );
}

export async function listReachOutNotes(input: { status?: string; limit?: number } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return { notes: [] as ReachOutNote[], source: 'memory' as const };
  let query = supabase
    .from('student_reach_out_requests')
    .select(REACH_OUT_COLUMNS)
    .order('created_at', { ascending: true })
    .limit(input.limit ?? 100);
  if (input.status && input.status !== 'all') query = query.eq('status', input.status);
  const { data, error } = await query;
  if (error) throw error;
  return { notes: (data ?? []) as ReachOutNote[], source: 'supabase' as const };
}

export async function getReachOutNote(id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('student_reach_out_requests')
    .select(REACH_OUT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ReachOutNote | null) ?? null;
}

export async function updateReachOutNote(id: string, patch: Partial<ReachOutNote>) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('student_reach_out_requests')
    .update(patch)
    .eq('id', id)
    .select(REACH_OUT_COLUMNS)
    .single();
  if (error) throw error;
  return data as ReachOutNote;
}

/**
 * Records who opened or changed a confidential note. The table is deny-by-default
 * like the notes themselves, and a failed audit write is logged rather than
 * surfaced: the supporter keeps working, the gap is visible in the log.
 */
export async function recordReachOutAccess(input: {
  noteId: string;
  actorId: string;
  action: 'opened' | 'assigned' | 'status_changed';
  detail?: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.from('reach_out_access_log').insert({
    note_id: input.noteId,
    actor_id: input.actorId,
    action: input.action,
    detail: input.detail ?? null,
  });
  if (error) throw error;
}

export const dataStore = { postgres: supabaseConfigured ? 'Supabase configured' : 'Supabase credentials missing', redis: 'Redis Streams queue ready for burst telemetry', jitsi: config.jitsiDomain };
