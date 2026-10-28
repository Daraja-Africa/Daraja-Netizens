alter table public.training_sessions
  add column if not exists week_key text,
  add column if not exists is_makeup boolean not null default false;
