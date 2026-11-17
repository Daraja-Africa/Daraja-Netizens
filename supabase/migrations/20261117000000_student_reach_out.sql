-- Confidential Student Portal reach-out requests.
--
-- A student can ask the Daraja wellness team for support without signing in, so
-- this table is deny-by-default: RLS is enabled, all privileges are revoked from
-- the browser roles, and no policies are created. The API writes rows with the
-- SUPABASE_SERVICE_ROLE_KEY on the server only; nothing in the browser can read
-- a student's note back.

create table if not exists public.student_reach_out_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  name text,
  contact_method text not null check (contact_method in ('whatsapp', 'phone', 'sms', 'email')),
  contact_detail text not null,
  support_topic text not null check (support_topic in (
    'stress-anxiety',
    'low-mood',
    'relationships',
    'grief',
    'digital-wellbeing',
    'supporting-a-friend',
    'other'
  )),
  urgency text not null check (urgency in ('within-24-hours', 'this-week', 'general-check-in')),
  message text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

comment on table public.student_reach_out_requests is
  'Confidential Student Portal reach-out notes. Written only by the API with the service-role key; deny-by-default RLS with no policies.';

create index if not exists student_reach_out_requests_created_at_idx
  on public.student_reach_out_requests (created_at desc);

alter table public.student_reach_out_requests enable row level security;
revoke all on table public.student_reach_out_requests from anon, authenticated;
