-- Reach-out triage: the operational half of the confidential note.
--
-- A student is promised that a supporter will contact them, so a note needs an
-- owner, a response clock and a record of who opened it. This migration adds
-- exactly that; the note's content is untouched.
--
-- `reach_out_access_log` is deny-by-default with no policies: like the notes
-- themselves, only the API's service-role client can write or read it, so a
-- browser can never enumerate who read a disclosure.

alter table public.student_reach_out_requests
  add column if not exists assigned_to uuid references public.users(id) on delete set null,
  add column if not exists first_response_at timestamptz,
  add column if not exists closed_at timestamptz;

comment on column public.student_reach_out_requests.assigned_to is
  'Supporter who owns the note. Null means nobody has claimed it yet.';
comment on column public.student_reach_out_requests.first_response_at is
  'First time a supporter moved the note out of new. Stops the response clock.';

-- Triage reads open notes oldest-first, and the overdue count filters by urgency.
create index if not exists student_reach_out_requests_triage_idx
  on public.student_reach_out_requests (status, urgency, created_at);

create index if not exists student_reach_out_requests_assigned_idx
  on public.student_reach_out_requests (assigned_to)
  where assigned_to is not null;

create table if not exists public.reach_out_access_log (
  id bigserial primary key,
  note_id uuid not null references public.student_reach_out_requests(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  action text not null check (action in ('opened', 'assigned', 'status_changed')),
  detail text,
  created_at timestamptz not null default now()
);

comment on table public.reach_out_access_log is
  'Who opened or changed a confidential reach-out note, and when. Written by the API only; deny-by-default RLS with no policies.';

create index if not exists reach_out_access_log_note_idx
  on public.reach_out_access_log (note_id, created_at desc);

alter table public.reach_out_access_log enable row level security;
revoke all on table public.reach_out_access_log from anon, authenticated;
