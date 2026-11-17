import { getSupabaseClient } from './supabase.js';

/**
 * Admin dashboard data: programme totals, the member directory, facilitator
 * access, programme sessions and manual session attendance.
 *
 * Facilitators never reach these helpers — the routes that call them are gated
 * with `requireAuth(['admin'])`. The few queries facilitators share (session
 * lists, session attendance) live in `supabase.ts` and are gated for both staff
 * roles instead.
 */

export type ManagedRole = 'admin' | 'facilitator' | 'student' | 'participant';

const MANAGED_ROLES: ManagedRole[] = ['admin', 'facilitator', 'student', 'participant'];

/** A rejected admin action the route should report with its own status code. */
export class AdminError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AdminError';
    this.status = status;
  }
}

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone: string | null;
  cohort: string | null;
  member_code: string | null;
  status: string | null;
  created_at: string | null;
};

export type SessionRow = {
  id: string;
  title: string;
  session_type: string;
  scheduled_at: string;
  status: string;
  required_for_training: boolean;
  required_for_stipend: boolean;
  week_key: string | null;
  is_makeup: boolean;
};

type AttendanceRow = { session_id: string; user_id: string; source: string; joined_at: string };

function client() {
  const supabase = getSupabaseClient();
  if (!supabase) throw new AdminError('Supabase credentials are required for the admin dashboard', 503);
  return supabase;
}

async function loadUsers(): Promise<UserRow[]> {
  const { data, error } = await client()
    .from('users')
    .select('id, full_name, email, role, phone, cohort, member_code, status, created_at')
    .order('full_name');
  if (error) throw error;
  return (data ?? []) as UserRow[];
}

export async function loadSessions(): Promise<SessionRow[]> {
  const { data, error } = await client()
    .from('training_sessions')
    .select('id, title, session_type, scheduled_at, status, required_for_training, required_for_stipend, week_key, is_makeup')
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}

async function loadAttendance(): Promise<AttendanceRow[]> {
  const { data, error } = await client()
    .from('attendance_logs')
    .select('session_id, user_id, source, joined_at')
    .gt('presence_seconds', 0)
    .not('session_id', 'is', null);
  if (error) throw error;
  return (data ?? []) as AttendanceRow[];
}

/** Roster members are the people in training, not the staff running it. */
export function isRosterMember(user: UserRow) {
  return user.role === 'student' || user.role === 'participant' || Boolean(user.member_code);
}

export function isStaff(user: { role: string }) {
  return user.role === 'admin' || user.role === 'facilitator';
}

/** Eligibility needs 7 of 8 required training sessions, and 2 of 3 stipend sessions. */
function threshold(count: number, ratio: number) {
  return count ? Math.max(1, Math.ceil(count * ratio)) : 0;
}

export type MemberSummary = UserRow & {
  sessionsAttended: number;
  attendedSessions: string[];
  trainingAttended: number;
  trainingRequired: number;
  trainingEligible: boolean;
  stipendAttended: number;
  stipendEligible: boolean;
  attendanceRate: number;
  lastAttendedAt: string | null;
};

/**
 * Joins each roster member to the sessions they attended. Pure, so the
 * dashboard, the member directory and the tests read eligibility the same way.
 */
export function summariseMembers(members: UserRow[], sessions: SessionRow[], attendance: AttendanceRow[]): MemberSummary[] {
  const requiredTraining = sessions.filter((session) => session.required_for_training);
  const requiredStipend = sessions.filter((session) => session.required_for_stipend);
  const trainingThreshold = threshold(requiredTraining.length, 7 / 8);
  const stipendThreshold = threshold(requiredStipend.length, 2 / 3);
  const titleById = new Map(sessions.map((session) => [session.id, session.title]));

  const byMember = new Map<string, AttendanceRow[]>();
  for (const row of attendance) {
    const rows = byMember.get(row.user_id);
    if (rows) rows.push(row);
    else byMember.set(row.user_id, [row]);
  }

  return members.map((member) => {
    const rows = byMember.get(member.id) ?? [];
    const attendedIds = new Set(rows.map((row) => row.session_id));
    const trainingAttended = requiredTraining.filter((session) => attendedIds.has(session.id)).length;
    const stipendAttended = requiredStipend.filter((session) => attendedIds.has(session.id)).length;
    const lastAttendedAt = rows.reduce<string | null>(
      (latest, row) => (!latest || row.joined_at > latest ? row.joined_at : latest),
      null
    );
    return {
      ...member,
      sessionsAttended: attendedIds.size,
      attendedSessions: [...attendedIds]
        .map((id) => titleById.get(id))
        .filter((title): title is string => Boolean(title)),
      trainingAttended,
      trainingRequired: requiredTraining.length,
      trainingEligible: requiredTraining.length > 0 && trainingAttended >= trainingThreshold,
      stipendAttended,
      stipendEligible: requiredStipend.length > 0 && stipendAttended >= stipendThreshold,
      attendanceRate: sessions.length ? Math.round((attendedIds.size / sessions.length) * 100) : 0,
      lastAttendedAt,
    };
  });
}

function sessionAttendanceCounts(attendance: AttendanceRow[]) {
  const counts = new Map<string, number>();
  for (const row of attendance) counts.set(row.session_id, (counts.get(row.session_id) ?? 0) + 1);
  return counts;
}

export async function getAdminOverview() {
  const [users, sessions, attendance] = await Promise.all([loadUsers(), loadSessions(), loadAttendance()]);
  const members = users.filter(isRosterMember);
  const summaries = summariseMembers(members, sessions, attendance);
  const counts = sessionAttendanceCounts(attendance);
  const now = Date.now();
  const upcoming = sessions.filter(
    (session) => new Date(session.scheduled_at).getTime() >= now && session.status !== 'completed' && session.status !== 'cancelled'
  );

  const cohortNames = [...new Set(members.map((member) => member.cohort).filter((cohort): cohort is string => Boolean(cohort)))].sort();
  const cohorts = cohortNames.map((cohort) => {
    const inCohort = summaries.filter((member) => member.cohort === cohort);
    const attended = inCohort.reduce((total, member) => total + member.sessionsAttended, 0);
    const possible = inCohort.length * sessions.length;
    return {
      cohort,
      members: inCohort.length,
      trainingEligible: inCohort.filter((member) => member.trainingEligible).length,
      attendanceRate: possible ? Math.round((attended / possible) * 100) : 0,
    };
  });

  return {
    totals: {
      members: members.length,
      facilitators: users.filter((user) => user.role === 'facilitator').length,
      admins: users.filter((user) => user.role === 'admin').length,
      sessions: sessions.length,
      upcomingSessions: upcoming.length,
      attendanceRecords: attendance.length,
      trainingEligible: summaries.filter((member) => member.trainingEligible).length,
      stipendEligible: summaries.filter((member) => member.stipendEligible).length,
      averageAttendanceRate: summaries.length
        ? Math.round(summaries.reduce((total, member) => total + member.attendanceRate, 0) / summaries.length)
        : 0,
    },
    cohorts,
    upcoming: upcoming.slice(0, 5).map((session) => ({
      id: session.id,
      title: session.title,
      session_type: session.session_type,
      scheduled_at: session.scheduled_at,
      status: session.status,
    })),
    recentSessions: [...sessions]
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
      .slice(0, 6)
      .map((session) => ({
        id: session.id,
        title: session.title,
        session_type: session.session_type,
        scheduled_at: session.scheduled_at,
        status: session.status,
        attendees: counts.get(session.id) ?? 0,
      })),
    source: 'supabase' as const,
  };
}

export async function getMemberDirectory() {
  const [users, sessions, attendance] = await Promise.all([loadUsers(), loadSessions(), loadAttendance()]);
  const members = summariseMembers(users.filter(isRosterMember), sessions, attendance);
  return {
    members,
    sessions: sessions.map((session) => ({ id: session.id, title: session.title, scheduled_at: session.scheduled_at })),
    totals: {
      members: members.length,
      trainingEligible: members.filter((member) => member.trainingEligible).length,
      stipendEligible: members.filter((member) => member.stipendEligible).length,
      averageAttendanceRate: members.length
        ? Math.round(members.reduce((total, member) => total + member.attendanceRate, 0) / members.length)
        : 0,
    },
    source: 'supabase' as const,
  };
}

export async function getFacilitatorDirectory() {
  const supabase = client();
  const [users, meetings, challenges] = await Promise.all([
    loadUsers(),
    supabase.from('meetings').select('host_id, title, scheduled_start, status'),
    supabase.from('qr_challenges').select('facilitator_id, redeemed_at, created_at'),
  ]);
  if (meetings.error) throw meetings.error;
  if (challenges.error) throw challenges.error;

  const meetingRows = meetings.data ?? [];
  const challengeRows = challenges.data ?? [];
  const staff = users.filter(isStaff);

  return {
    facilitators: staff
      .map((user) => {
        const hosted = meetingRows.filter((row) => row.host_id === user.id);
        const issued = challengeRows.filter((row) => row.facilitator_id === user.id);
        const lastHostedAt = hosted.reduce<string | null>(
          (latest, row) => (!latest || String(row.scheduled_start) > latest ? String(row.scheduled_start) : latest),
          null
        );
        return {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role as ManagedRole,
          phone: user.phone,
          created_at: user.created_at,
          hostedMeetings: hosted.length,
          lastHostedAt,
          checkInsIssued: issued.length,
          checkInsRedeemed: issued.filter((row) => row.redeemed_at).length,
        };
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    candidates: users
      .filter((user) => isRosterMember(user) && !isStaff(user))
      .map((user) => ({ id: user.id, full_name: user.full_name, email: user.email, cohort: user.cohort })),
    source: 'supabase' as const,
  };
}

export async function updateUserRole(actingUserId: string, targetId: string, role: ManagedRole) {
  if (!MANAGED_ROLES.includes(role)) throw new AdminError('Choose a valid role');
  if (actingUserId === targetId) throw new AdminError('You cannot change your own role', 409);

  const { data, error } = await client()
    .from('users')
    .update({ role })
    .eq('id', targetId)
    .select('id, full_name, email, role')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AdminError('That profile no longer exists', 404);
  return data;
}

export async function getProgramData() {
  const [sessions, attendance] = await Promise.all([loadSessions(), loadAttendance()]);
  const counts = sessionAttendanceCounts(attendance);
  return {
    sessions: [...sessions]
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
      .map((session) => ({
        ...session,
        attendees: counts.get(session.id) ?? 0,
      })),
    totals: {
      sessions: sessions.length,
      physical: sessions.filter((session) => session.session_type === 'physical').length,
      online: sessions.filter((session) => session.session_type === 'online').length,
      completed: sessions.filter((session) => session.status === 'completed').length,
      requiredForTraining: sessions.filter((session) => session.required_for_training).length,
      requiredForStipend: sessions.filter((session) => session.required_for_stipend).length,
    },
    source: 'supabase' as const,
  };
}

export type SessionPatch = {
  title?: string;
  session_type?: 'physical' | 'online';
  scheduled_at?: string;
  status?: string;
  required_for_training?: boolean;
  required_for_stipend?: boolean;
  week_key?: string | null;
  is_makeup?: boolean;
};

export async function updateTrainingSession(id: string, patch: SessionPatch) {
  if (!Object.keys(patch).length) throw new AdminError('Nothing to update');
  const { data, error } = await client()
    .from('training_sessions')
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AdminError('That training session no longer exists', 404);
  return data;
}

export async function getSessionAttendance(sessionId: string) {
  const supabase = client();
  const [session, users, attendance] = await Promise.all([
    supabase
      .from('training_sessions')
      .select('id, title, session_type, scheduled_at, status, required_for_training')
      .eq('id', sessionId)
      .maybeSingle(),
    loadUsers(),
    supabase.from('attendance_logs').select('id, user_id, source, presence_seconds').eq('session_id', sessionId),
  ]);
  if (session.error) throw session.error;
  if (attendance.error) throw attendance.error;
  if (!session.data) throw new AdminError('That training session no longer exists', 404);

  const recorded = new Map((attendance.data ?? []).map((row) => [row.user_id as string, row]));
  const members = users
    .filter(isRosterMember)
    .map((member) => {
      const row = recorded.get(member.id);
      const present = Boolean(row && Number(row.presence_seconds) > 0);
      return {
        id: member.id,
        full_name: member.full_name,
        email: member.email,
        cohort: member.cohort,
        present,
        source: present ? String(row?.source ?? 'manual') : null,
        locked: present && row?.source !== 'manual',
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return {
    session: session.data,
    members,
    present: members.filter((member) => member.present).length,
    total: members.length,
    source: 'supabase' as const,
  };
}

/**
 * Marks or clears one member's attendance for a session. Records created by an
 * import or a QR check-in are kept: the screen can only undo its own manual
 * marks, so historical attendance is never lost from the admin view.
 */
export async function setSessionAttendance(input: { sessionId: string; memberId: string; present: boolean }) {
  const supabase = client();
  const { data: rows, error } = await supabase
    .from('attendance_logs')
    .select('id, source, presence_seconds')
    .eq('session_id', input.sessionId)
    .eq('user_id', input.memberId)
    .limit(1);
  if (error) throw error;
  const existing = rows?.[0];

  if (input.present) {
    if (existing && Number(existing.presence_seconds) > 0) {
      return { present: true, changed: false, source: String(existing.source ?? 'manual') };
    }
    if (existing) {
      const { error: updateError } = await supabase
        .from('attendance_logs')
        .update({ presence_seconds: 1, joined_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (updateError) throw updateError;
      return { present: true, changed: true, source: String(existing.source ?? 'manual') };
    }
    const { error: insertError } = await supabase.from('attendance_logs').insert({
      session_id: input.sessionId,
      user_id: input.memberId,
      joined_at: new Date().toISOString(),
      presence_seconds: 1,
      source: 'manual',
    });
    if (insertError) throw insertError;
    return { present: true, changed: true, source: 'manual' };
  }

  if (!existing) return { present: false, changed: false, source: null };
  if (existing.source !== 'manual') {
    throw new AdminError('This attendance came from an import or QR check-in and cannot be removed here', 409);
  }
  const { error: deleteError } = await supabase.from('attendance_logs').delete().eq('id', existing.id);
  if (deleteError) throw deleteError;
  return { present: false, changed: true, source: 'manual' };
}

export async function getFacilitatorOverview(userId: string) {
  const supabase = client();
  const [sessions, attendance, meetings, challenges] = await Promise.all([
    loadSessions(),
    loadAttendance(),
    supabase.from('meetings').select('id, room_key, title, scheduled_start, status').eq('host_id', userId).order('scheduled_start', { ascending: false }),
    supabase.from('qr_challenges').select('id, session_id, expires_at, redeemed_at, created_at').eq('facilitator_id', userId).order('created_at', { ascending: false }),
  ]);
  if (meetings.error) throw meetings.error;
  if (challenges.error) throw challenges.error;

  const counts = sessionAttendanceCounts(attendance);
  const titleById = new Map(sessions.map((session) => [session.id, session.title]));
  const now = Date.now();
  const challengeRows = challenges.data ?? [];

  return {
    stats: {
      sessions: sessions.length,
      completedSessions: sessions.filter((session) => session.status === 'completed').length,
      upcomingSessions: sessions.filter(
        (session) => new Date(session.scheduled_at).getTime() >= now && session.status !== 'completed' && session.status !== 'cancelled'
      ).length,
      attendanceRecords: attendance.length,
      hostedMeetings: (meetings.data ?? []).length,
      checkInsIssued: challengeRows.length,
      checkInsRedeemed: challengeRows.filter((row) => row.redeemed_at).length,
    },
    sessions: [...sessions]
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
      .map((session) => ({
        id: session.id,
        title: session.title,
        session_type: session.session_type,
        scheduled_at: session.scheduled_at,
        status: session.status,
        required_for_training: session.required_for_training,
        attendees: counts.get(session.id) ?? 0,
      })),
    recentMeetings: (meetings.data ?? []).slice(0, 5),
    recentCheckIns: challengeRows.slice(0, 5).map((row) => ({
      id: row.id,
      sessionTitle: titleById.get(row.session_id as string) ?? 'Training session',
      created_at: row.created_at,
      expires_at: row.expires_at,
      redeemed_at: row.redeemed_at,
    })),
    source: 'supabase' as const,
  };
}
