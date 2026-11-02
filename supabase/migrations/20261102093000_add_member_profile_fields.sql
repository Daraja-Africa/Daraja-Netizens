alter table public.users
  add column if not exists national_id text,
  add column if not exists phone text,
  add column if not exists status text not null default 'active',
  add column if not exists source text;

create index if not exists idx_users_national_id on public.users(national_id);

create unique index if not exists idx_training_sessions_title_scheduled_at
  on public.training_sessions(title, scheduled_at);

alter table public.attendance_logs
  alter column meeting_id drop not null;
