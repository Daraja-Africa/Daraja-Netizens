-- Normalize every stored roster email and repair existing Auth profile links.
update public.users
   set email = lower(trim(email))
 where email is not null
   and email <> lower(trim(email));

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
  v_seed public.users%rowtype;
begin
  if p_auth_id is null or v_email = '' then
    return null;
  end if;

  select * into v_seed
  from public.users u
  where lower(trim(u.email)) = v_email
    and u.id <> p_auth_id
  order by u.created_at
  limit 1;

  -- An account may already own the Auth uuid while its name or links were seeded
  -- under a placeholder uuid. Preserve student profiles, but hydrate roster rows.
  if exists (select 1 from public.users u where u.id = p_auth_id) then
    if found then
      update public.users
         set email = v_seed.id::text || '@migrated.local',
             member_code = null
       where id = v_seed.id;
      update public.users u
         set email = v_email,
             full_name = coalesce(
               nullif(trim(v_seed.full_name), ''),
               nullif(trim(coalesce(p_full_name, '')), ''),
               v_email
             ),
             role = v_seed.role,
             national_id = v_seed.national_id,
             phone = v_seed.phone,
             cohort = v_seed.cohort,
             member_code = v_seed.member_code,
             status = coalesce(v_seed.status, 'active'),
             source = v_seed.source
       where u.id = p_auth_id;
      update public.attendance_logs set user_id = p_auth_id where user_id = v_seed.id;
      update public.telemetry_events set user_id = p_auth_id where user_id = v_seed.id;
      update public.meetings set host_id = p_auth_id where host_id = v_seed.id;
      update public.qr_challenges set facilitator_id = p_auth_id where facilitator_id = v_seed.id;
      update public.qr_challenges set redeemed_by = p_auth_id where redeemed_by = v_seed.id;
      update public.member_aliases set member_id = p_auth_id where member_id = v_seed.id;
      update public.attendance_unmatched_entries set member_id = p_auth_id where member_id = v_seed.id;
      delete from public.users where id = v_seed.id;
    else
      update public.users u set email = v_email
       where u.id = p_auth_id;
    end;
    return p_auth_id;
  end if;

  if not found then
    return null;
  end if;

  update public.users
     set email = v_seed.id::text || '@migrated.local',
         member_code = null
   where id = v_seed.id;

  insert into public.users (
    id, email, full_name, role, created_at,
    national_id, phone, status, source, member_code, cohort
  ) values (
    p_auth_id,
    v_email,
    coalesce(nullif(trim(v_seed.full_name), ''), nullif(trim(coalesce(p_full_name, '')), ''), v_email),
    v_seed.role,
    v_seed.created_at,
    v_seed.national_id,
    v_seed.phone,
    coalesce(v_seed.status, 'active'),
    v_seed.source,
    v_seed.member_code,
    v_seed.cohort
  );

  update public.attendance_logs set user_id = p_auth_id where user_id = v_seed.id;
  update public.telemetry_events set user_id = p_auth_id where user_id = v_seed.id;
  update public.meetings set host_id = p_auth_id where host_id = v_seed.id;
  update public.qr_challenges set facilitator_id = p_auth_id where facilitator_id = v_seed.id;
  update public.qr_challenges set redeemed_by = p_auth_id where redeemed_by = v_seed.id;
  update public.member_aliases set member_id = p_auth_id where member_id = v_seed.id;
  update public.attendance_unmatched_entries set member_id = p_auth_id where member_id = v_seed.id;

  delete from public.users where id = v_seed.id;
  return p_auth_id;
end;
$$;

revoke all on function public.reconcile_seeded_profile(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reconcile_seeded_profile(uuid, text, text) to service_role;

-- Re-run reconciliation for every existing Auth account against normalized roster emails.
do $$
declare
  v_user record;
begin
  for v_user in
    select au.id, au.email, au.raw_user_meta_data->>'full_name' as full_name
    from auth.users au
  loop
    perform public.reconcile_seeded_profile(v_user.id, v_user.email, v_user.full_name);
  end loop;
end $$;
