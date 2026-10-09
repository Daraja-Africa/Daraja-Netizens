create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role text not null default 'participant',
  created_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  room_key text not null unique,
  title text not null default 'Daraja meeting',
  host_id uuid references public.users(id) on delete set null,
  scheduled_start timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null,
  left_at timestamptz,
  presence_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_attendance_meeting_user
  on public.attendance_logs(meeting_id, user_id);

create table if not exists public.telemetry_events (
  id bigserial primary key,
  attendance_id uuid references public.attendance_logs(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_meetings_host_id on public.meetings(host_id);
create index if not exists idx_attendance_meeting on public.attendance_logs(meeting_id);
create index if not exists idx_telemetry_meeting on public.telemetry_events(meeting_id);
create index if not exists idx_telemetry_attendance on public.telemetry_events(attendance_id);
