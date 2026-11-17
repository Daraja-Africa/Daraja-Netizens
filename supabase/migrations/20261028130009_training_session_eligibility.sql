-- Adds the eligibility columns to training_sessions.
--
-- This migration version sorts before 20261028150000, which creates the table,
-- so on a database built from scratch the ALTER below would fail before the
-- table exists. It is guarded instead: the columns are added when the table is
-- already present (every project that has run these migrations so far), and the
-- creating migration defines the same two columns for a fresh database.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'training_sessions'
  ) then
    execute 'alter table public.training_sessions
      add column if not exists week_key text,
      add column if not exists is_makeup boolean not null default false';
  end if;
end $$;
