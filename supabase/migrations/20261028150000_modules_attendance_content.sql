alter table public.meetings add column if not exists meeting_type text not null default 'online';
alter table public.attendance_logs add column if not exists source text not null default 'online_jitsi';

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  session_type text not null check (session_type in ('physical', 'online')),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled',
  required_for_training boolean not null default true,
  required_for_stipend boolean not null default false,
  week_key text,
  is_makeup boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.attendance_logs add column if not exists session_id uuid references public.training_sessions(id) on delete cascade;

create table if not exists public.qr_challenges (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  facilitator_id uuid not null references public.users(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  url text not null,
  category text not null default 'learning',
  published boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.support_contacts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  channel text not null check (channel in ('phone', 'sms', 'whatsapp', 'url')),
  value text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.training_sessions enable row level security;
alter table public.qr_challenges enable row level security;
alter table public.content_items enable row level security;
alter table public.support_contacts enable row level security;

revoke all on table public.training_sessions from anon, authenticated;
revoke all on table public.qr_challenges from anon, authenticated;
revoke all on table public.content_items from anon, authenticated;
revoke all on table public.support_contacts from anon, authenticated;
