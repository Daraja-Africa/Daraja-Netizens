-- Member roster and imported lesson attendance: schema.
--
-- Normalizes the facilitator roster spreadsheet (Sheet 1 = members, Sheet 2 =
-- cohort groups) and the four dated lesson attendance documents onto the
-- existing people / session / attendance tables, so imported records are read by
-- the same queries as live attendance.
--
-- Additive and re-runnable: no existing column, row or policy is dropped.

alter table public.users
  add column if not exists member_code text,
  add column if not exists cohort text;

-- Attendance captured live has no display name; imports keep the name it came
-- with ("Betty", "Zei Tunie") so a facilitator can audit the match later.
alter table public.attendance_logs
  add column if not exists source_label text;

-- A roster member is identified by its member_code, independent of the Auth
-- account that may later sign in with the same email.
create unique index if not exists idx_users_member_code
  on public.users(member_code)
  where member_code is not null;

-- Meet display names that resolve to a member but are not the official roster
-- name. The import workflow reuses these rows, so a name resolved once resolves
-- automatically on the next upload.
create table if not exists public.member_aliases (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.users(id) on delete cascade,
  alias text not null,
  alias_key text not null unique,
  source text not null default 'historical_import',
  created_at timestamptz not null default now()
);

-- Exported attendance can contain names that match no member: initials,
-- nicknames, a guest trainer. They are kept verbatim for review instead of being
-- dropped or invented into the roster.
create table if not exists public.attendance_unmatched_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  display_name text not null,
  display_key text not null,
  role_note text,
  resolution text not null default 'pending'
    check (resolution in ('pending', 'linked', 'ignored')),
  member_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, display_key)
);

create index if not exists idx_member_aliases_member on public.member_aliases(member_id);
create index if not exists idx_unmatched_session on public.attendance_unmatched_entries(session_id);

alter table public.member_aliases enable row level security;
alter table public.attendance_unmatched_entries enable row level security;

revoke all on table public.member_aliases from anon, authenticated;
revoke all on table public.attendance_unmatched_entries from anon, authenticated;
