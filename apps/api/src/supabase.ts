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
  const trainingTotal = sessionRows.filter((item) => item.required_for_training).length;
  const stipendTotal = sessionRows.filter((item) => item.required_for_stipend).length;
  return {
    stats: {
      physicalSessions: sessionRows.filter((item) => item.session_type === 'physical').length,
      onlineSessions: sessionRows.filter((item) => item.session_type === 'online').length,
      attendanceRate: attendance.data?.length ? Math.round((attended / attendance.data.length) * 100) : 0,
      trainingProgress: trainingTotal ? Math.round((attended / trainingTotal) * 100) : 0,
      stipendProgress: stipendTotal ? Math.round((Math.min(attended, stipendTotal) / stipendTotal) * 100) : 0,
    },
    sessions: sessionRows,
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

export async function redeemQrChallenge(input: { token: string; studentId: string }) {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: true, source: 'memory' };
  const { data: challenge, error: challengeError } = await supabase.from('qr_challenges').select('id, session_id, expires_at, redeemed_at').eq('token', input.token).maybeSingle();
  if (challengeError) throw challengeError;
  if (!challenge || challenge.redeemed_at || new Date(challenge.expires_at).getTime() < Date.now()) throw new Error('QR challenge is expired or already used');
  const { error: redeemError } = await supabase.from('qr_challenges').update({ redeemed_at: new Date().toISOString(), redeemed_by: input.studentId }).eq('id', challenge.id).is('redeemed_at', null);
  if (redeemError) throw redeemError;
  const { error: attendanceError } = await supabase.from('attendance_logs').upsert({ meeting_id: challenge.session_id, user_id: input.studentId, joined_at: new Date().toISOString(), presence_seconds: 0, source: 'physical_qr' }, { onConflict: 'meeting_id,user_id' });
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
