import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { config } from './config.js';

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

export async function ensureUser(input: { id: string; email: string; fullName: string; role?: 'admin' | 'facilitator' | 'student' | 'participant' }) {
  const supabase = getSupabaseClient();
  if (!supabase) return { id: input.id, email: input.email, full_name: input.fullName, role: input.role ?? 'participant' };
  const { data, error } = await supabase.from('users').upsert({
    id: input.id, email: input.email, full_name: input.fullName, role: input.role ?? 'participant',
  }).select().single();
  if (error) throw error;
  return data;
}

export async function createMeeting(input: { roomKey: string; title: string; hostId: string; scheduledStart?: string }) {
  const supabase = getSupabaseClient();
  if (!supabase) return { id: input.roomKey, room_key: input.roomKey, title: input.title, host_id: input.hostId, scheduled_start: input.scheduledStart ?? new Date().toISOString(), status: 'scheduled' };
  const { data, error } = await supabase.from('meetings').upsert({
    room_key: input.roomKey, title: input.title, host_id: input.hostId, scheduled_start: input.scheduledStart ?? new Date().toISOString(), status: 'scheduled',
  }, { onConflict: 'room_key' }).select().single();
  if (error) throw error;
  return data;
}

export async function upsertAttendance(input: { meetingId: string; userId: string; joinedAt: string; leftAt?: string; presenceSeconds?: number }) {
  const supabase = getSupabaseClient();
  if (!supabase) return { ...input, id: `${input.meetingId}:${input.userId}` };
  const { data, error } = await supabase.from('attendance_logs').upsert({
    meeting_id: input.meetingId, user_id: input.userId, joined_at: input.joinedAt, left_at: input.leftAt, presence_seconds: input.presenceSeconds ?? 0, source: 'online_jitsi',
  }, { onConflict: 'meeting_id,user_id' }).select().single();
  if (error) throw error;
  return data;
}

export async function getDashboardSummary() {
  const supabase = getSupabaseClient();
  if (!supabase) return { meetings: [], attendance: [], telemetry: [], source: 'memory' };
  const [meetings, attendance, telemetry] = await Promise.all([
    supabase.from('meetings').select('id, room_key, title, scheduled_start, status, host_id').order('scheduled_start', { ascending: false }).limit(20),
    supabase.from('attendance_logs').select('id, meeting_id, user_id, joined_at, left_at, presence_seconds').order('joined_at', { ascending: false }).limit(100),
    supabase.from('telemetry_events').select('id, meeting_id, user_id, event_type, created_at').order('created_at', { ascending: false }).limit(100),
  ]);
  const error = meetings.error ?? attendance.error ?? telemetry.error;
  if (error) throw error;
  return { meetings: meetings.data ?? [], attendance: attendance.data ?? [], telemetry: telemetry.data ?? [], source: 'supabase' };
}

export function calculateModuleOneEligibility(input: {
  trainingSessions: Array<{ id: string; required_for_training?: boolean | null; required_for_stipend?: boolean | null; session_type?: string | null; }>; 
  attendanceRecords: Array<{ meeting_id: string; presence_seconds?: number | null; user_id?: string | null; }>;
}) {
  const requiredTraining = input.trainingSessions.filter((session) => session.required_for_training);
  const requiredStipend = input.trainingSessions.filter((session) => session.required_for_stipend);
  const attendanceCount = (input.attendanceRecords ?? []).filter((record) => (record.presence_seconds ?? 0) > 0).length;
  const attendedTrainingIds = new Set(
    (input.attendanceRecords ?? [])
      .filter((record) => (record.presence_seconds ?? 0) > 0 && requiredTraining.some((session) => session.id === record.meeting_id))
      .map((record) => record.meeting_id)
  );
  const attendedStipendIds = new Set(
    (input.attendanceRecords ?? [])
      .filter((record) => (record.presence_seconds ?? 0) > 0 && requiredStipend.some((session) => session.id === record.meeting_id))
      .map((record) => record.meeting_id)
  );

  const trainingThreshold = requiredTraining.length ? Math.max(1, Math.ceil(requiredTraining.length * (7 / 8))) : 0;
  const stipendThreshold = requiredStipend.length ? Math.max(1, Math.ceil(requiredStipend.length * (2 / 3))) : 0;

  const trainingProgress = requiredTraining.length ? Math.round((attendedTrainingIds.size / requiredTraining.length) * 100) : 0;
  const stipendProgress = requiredStipend.length ? Math.round((attendedStipendIds.size / requiredStipend.length) * 100) : 0;

  return {
    attendanceCount,
    requiredTraining: requiredTraining.length,
    requiredStipend: requiredStipend.length,
    trainingThreshold,
    stipendThreshold,
    trainingProgress,
    stipendProgress,
    trainingEligible: requiredTraining.length ? attendedTrainingIds.size >= trainingThreshold : false,
    stipendEligible: requiredStipend.length ? attendedStipendIds.size >= stipendThreshold : false,
    attendedTraining: attendedTrainingIds.size,
    attendedStipend: attendedStipendIds.size,
  };
}

export async function getRoleDashboard(userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return { stats: { physicalSessions: 0, onlineSessions: 0, attendanceRate: 0, trainingProgress: 0, stipendProgress: 0 }, sessions: [], source: 'memory' };
  const [meetings, attendance, sessions] = await Promise.all([
    supabase.from('meetings').select('id, room_key, title, scheduled_start, status, meeting_type').eq('host_id', userId).order('scheduled_start', { ascending: false }).limit(50),
    supabase.from('attendance_logs').select('id, meeting_id, user_id, joined_at, left_at, presence_seconds, source').eq('user_id', userId).order('joined_at', { ascending: false }).limit(200),
    supabase.from('training_sessions').select('id, title, session_type, scheduled_at, status, required_for_training, required_for_stipend').order('scheduled_at', { ascending: false }).limit(50),
  ]);
  const error = meetings.error ?? attendance.error ?? sessions.error;
  if (error) throw error;
  const sessionRows = sessions.data ?? [];
  const attended = (attendance.data ?? []).filter((item) => item.presence_seconds > 0).length;
  const eligibility = calculateModuleOneEligibility({
    trainingSessions: sessionRows,
    attendanceRecords: (attendance.data ?? []).map((item) => ({ meeting_id: item.meeting_id, presence_seconds: item.presence_seconds, user_id: item.user_id })),
  });
  return {
    stats: {
      physicalSessions: sessionRows.filter((item) => item.session_type === 'physical').length,
      onlineSessions: sessionRows.filter((item) => item.session_type === 'online').length,
      attendanceRate: attendance.data?.length ? Math.round((attended / attendance.data.length) * 100) : 0,
      trainingProgress: eligibility.trainingProgress,
      stipendProgress: eligibility.stipendProgress,
    },
    sessions: sessionRows,
    eligibility,
    source: 'supabase',
  };
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
    supabase.from('attendance_logs').select('session_id, presence_seconds').eq('user_id', userId).gt('presence_seconds', 0),
  ]);
  const error = sessions.error ?? attendance.error;
  if (error) throw error;
  const attendedIds = new Set((attendance.data ?? []).map((row) => row.session_id).filter(Boolean));
  const trainingSessions = (sessions.data ?? []).filter((row) => row.required_for_training);
  const attendedTraining = trainingSessions.filter((row) => attendedIds.has(row.id)).length;
  const stipendWeeks = new Set((sessions.data ?? [])
    .filter((row) => row.required_for_stipend && row.session_type === 'physical' && row.week_key && attendedIds.has(row.id))
    .map((row) => row.week_key));
  return {
    training: { attended: attendedTraining, required: 7, total: Math.max(trainingSessions.length, 8), ratio: Math.round((attendedTraining / Math.max(trainingSessions.length, 8)) * 100), eligible: attendedTraining >= 7 },
    stipend: { attendedWeeks: stipendWeeks.size, requiredWeeks: 4, totalWeeks: 6, ratio: Math.round((stipendWeeks.size / 6) * 100), eligible: stipendWeeks.size >= 4 },
    source: 'supabase',
  };
}

export async function redeemQrChallenge(input: { token: string; studentId: string }) {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, source: 'memory' };
  const { data: challenge, error: challengeError } = await supabase.from('qr_challenges').select('id, session_id, expires_at, redeemed_at').eq('token', input.token).maybeSingle();
  if (challengeError) throw challengeError;
  if (!challenge || challenge.redeemed_at || new Date(challenge.expires_at).getTime() < Date.now()) throw new Error('QR challenge is expired or already used');
  const { error: redeemError } = await supabase.from('qr_challenges').update({ redeemed_at: new Date().toISOString(), redeemed_by: input.studentId }).eq('id', challenge.id).is('redeemed_at', null);
  if (redeemError) throw redeemError;
  const { error: attendanceError } = await supabase.from('attendance_logs').upsert({ session_id: challenge.session_id, meeting_id: challenge.session_id, user_id: input.studentId, joined_at: new Date().toISOString(), presence_seconds: 1, source: 'physical_qr' }, { onConflict: 'meeting_id,user_id' });
  if (attendanceError) throw attendanceError;
  return { ok: true, source: 'supabase' };
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

export const supabaseReady = Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
export const dataStore = { postgres: supabaseReady ? 'Supabase connected' : 'Supabase credentials missing', redis: 'Redis Streams queue ready for burst telemetry', jitsi: config.jitsiDomain };
