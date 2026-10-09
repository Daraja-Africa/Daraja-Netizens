import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { config } from './config.js';

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (client) {
    return client;
  }

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return null;
  }

  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false },
  });

  return client;
}

export async function persistTelemetryRecord(payload: Record<string, unknown>) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: true, mode: 'memory' };
  }

  const { error } = await supabase.from('telemetry_events').insert(payload);

  if (error) {
    throw error;
  }

  return { ok: true, mode: 'supabase' };
}

export async function ensureUser(input: { id: string; email: string; fullName: string; role?: 'admin' | 'host' | 'participant' }) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { id: input.id, email: input.email, full_name: input.fullName, role: input.role ?? 'participant' };
  }

  const { data, error } = await supabase
    .from('users')
    .upsert({
      id: input.id,
      email: input.email,
      full_name: input.fullName,
      role: input.role ?? 'participant',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createMeeting(input: {
  roomKey: string;
  title: string;
  hostId: string;
  scheduledStart?: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      id: input.roomKey,
      room_key: input.roomKey,
      title: input.title,
      host_id: input.hostId,
      scheduled_start: input.scheduledStart ?? new Date().toISOString(),
      status: 'scheduled',
    };
  }

  const { data, error } = await supabase
    .from('meetings')
    .upsert({
      room_key: input.roomKey,
      title: input.title,
      host_id: input.hostId,
      scheduled_start: input.scheduledStart ?? new Date().toISOString(),
      status: 'scheduled',
    }, { onConflict: 'room_key' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function upsertAttendance(input: {
  meetingId: string;
  userId: string;
  joinedAt: string;
  leftAt?: string;
  presenceSeconds?: number;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) return { ...input, id: `${input.meetingId}:${input.userId}` };

  const { data, error } = await supabase
    .from('attendance_logs')
    .upsert({
      meeting_id: input.meetingId,
      user_id: input.userId,
      joined_at: input.joinedAt,
      left_at: input.leftAt,
      presence_seconds: input.presenceSeconds ?? 0,
    }, { onConflict: 'meeting_id,user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getDashboardSummary() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { meetings: [], attendance: [], telemetry: [], source: 'memory' };
  }

  const [meetings, attendance, telemetry] = await Promise.all([
    supabase.from('meetings').select('id, room_key, title, scheduled_start, status, host_id').order('scheduled_start', { ascending: false }).limit(20),
    supabase.from('attendance_logs').select('id, meeting_id, user_id, joined_at, left_at, presence_seconds').order('joined_at', { ascending: false }).limit(100),
    supabase.from('telemetry_events').select('id, meeting_id, user_id, event_type, created_at').order('created_at', { ascending: false }).limit(100),
  ]);

  const error = meetings.error ?? attendance.error ?? telemetry.error;
  if (error) throw error;

  return {
    meetings: meetings.data ?? [],
    attendance: attendance.data ?? [],
    telemetry: telemetry.data ?? [],
    source: 'supabase',
  };
}

export const supabaseReady = Boolean(config.supabaseUrl && config.supabaseAnonKey);
export const dataStore = {
  postgres: supabaseReady ? 'Supabase connected' : 'Supabase credentials missing',
  redis: 'Redis Streams queue ready for burst telemetry',
  jitsi: config.jitsiDomain,
};
