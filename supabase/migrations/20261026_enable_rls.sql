-- The API is the only application boundary that writes these tables.
-- Its server-side service_role key bypasses RLS; browser clients do not receive
-- a database key, so the public API surface remains deny-by-default.
alter table public.users enable row level security;
alter table public.meetings enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.telemetry_events enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.meetings from anon, authenticated;
revoke all on table public.attendance_logs from anon, authenticated;
revoke all on table public.telemetry_events from anon, authenticated;
