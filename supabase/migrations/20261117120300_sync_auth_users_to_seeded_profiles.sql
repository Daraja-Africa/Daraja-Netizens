-- Google OAuth identity reconciliation.
--
-- The roster in public.users is seeded before anyone signs in, so its ids are
-- placeholder uuids (md5(email) in the seed). Supabase Auth assigns a different
-- uuid on the first Google sign-in, which left signed-in facilitators with the
-- "Daraja facilitator" fallback name and no attendance history.
--
-- This migration links an Auth account to the seeded profile that owns the same
-- email: the seeded profile is re-created under the Auth uuid, every row that
-- referenced the placeholder is re-pointed at it, and the placeholder is
-- removed. Emails that are not on the roster are ignored, so Module 1 stays
-- limited to pre-approved profiles.
--
-- Re-runnable: an account already linked is only kept in sync.

-- ---------------------------------------------------------------------------
-- Core reconciliation, shared by the trigger and the one-time backfill.
-- Returns the linked profile id, or null when the email is not on the roster.
-- ---------------------------------------------------------------------------
create or replace function public.reconcile_seeded_profile(
  p_auth_id uuid,
  p_email text,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_old public.users%rowtype;
begin
  if p_auth_id is null or v_email = '' then
    return null;
  end if;

  -- Already linked: keep the stored email in sync and stop.
  if exists (select 1 from public.users u where u.id = p_auth_id) then
    update public.users u
       set email = v_email
     where u.id = p_auth_id
       and u.email <> v_email;
    return p_auth_id;
  end if;

  select * into v_old
  from public.users u
  where lower(trim(u.email)) = v_email
  order by u.created_at
  limit 1;

  -- Not on the roster: never invent a facilitator or admin profile.
  if not found then
    return null;
  end if;

  -- Free the unique email and member_code so the replacement row can own them.
  update public.users
     set email = v_old.id::text || '@migrated.local',
         member_code = null
   where id = v_old.id;

  insert into public.users (
    id, email, full_name, role, created_at,
    national_id, phone, status, source, member_code, cohort
  ) values (
    p_auth_id,
    v_email,
    coalesce(nullif(trim(v_old.full_name), ''), nullif(trim(coalesce(p_full_name, '')), ''), v_email),
    v_old.role,
    v_old.created_at,
    v_old.national_id,
    v_old.phone,
    coalesce(v_old.status, 'active'),
    v_old.source,
    v_old.member_code,
    v_old.cohort
  );

  -- Re-point every row that referenced the placeholder profile.
  update public.attendance_logs set user_id = p_auth_id where user_id = v_old.id;
  update public.telemetry_events set user_id = p_auth_id where user_id = v_old.id;
  update public.meetings set host_id = p_auth_id where host_id = v_old.id;
  update public.qr_challenges set facilitator_id = p_auth_id where facilitator_id = v_old.id;
  update public.qr_challenges set redeemed_by = p_auth_id where redeemed_by = v_old.id;
  update public.member_aliases set member_id = p_auth_id where member_id = v_old.id;
  update public.attendance_unmatched_entries set member_id = p_auth_id where member_id = v_old.id;

  delete from public.users where id = v_old.id;
  return p_auth_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: heal the profile on the Auth insert and on every later sign-in.
-- ---------------------------------------------------------------------------
create or replace function public.handle_auth_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.reconcile_seeded_profile(
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_sync on auth.users;

create trigger on_auth_user_sync
  after insert or update of email, last_sign_in_at on auth.users
  for each row
  execute function public.handle_auth_user_sync();

-- Only the API's service role may call the reconciliation directly; the browser
-- roles never may. The trigger itself needs no EXECUTE grant.
revoke all on function public.reconcile_seeded_profile(uuid, text, text) from public, anon, authenticated;
revoke all on function public.handle_auth_user_sync() from public, anon, authenticated;
grant execute on function public.reconcile_seeded_profile(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- One-time backfill for accounts that signed in before this migration.
-- ---------------------------------------------------------------------------
do $$
declare
  v_pairs jsonb;
  v_pair record;
begin
  select coalesce(
           jsonb_agg(jsonb_build_object(
             'id', au.id,
             'email', au.email,
             'full_name', au.raw_user_meta_data->>'full_name'
           )),
           '[]'::jsonb
         )
    into v_pairs
  from auth.users au
  join public.users pu on lower(trim(pu.email)) = lower(trim(au.email))
  where pu.id <> au.id;

  for v_pair in select * from jsonb_array_elements(v_pairs) loop
    perform public.reconcile_seeded_profile(
      (v_pair.value->>'id')::uuid,
      v_pair.value->>'email',
      v_pair.value->>'full_name'
    );
  end loop;
end $$;
