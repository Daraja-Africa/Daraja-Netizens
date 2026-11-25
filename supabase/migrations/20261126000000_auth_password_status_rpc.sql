-- Service-role-only lookup used by the first-login password setup flow.
-- It deliberately returns status metadata rather than the password hash itself.
create or replace function public.get_member_password_status(p_email text)
returns table (
  email text,
  full_name text,
  role text,
  status text,
  auth_user_id uuid,
  has_password boolean
)
language sql
security definer
set search_path = public, auth
as $$
  select
    lower(trim(u.email)) as email,
    u.full_name,
    u.role::text,
    u.status,
    au.id as auth_user_id,
    coalesce(nullif(au.encrypted_password, '') is not null, false) as has_password
  from public.users u
  left join auth.users au on lower(trim(au.email)) = lower(trim(u.email))
  where lower(trim(u.email)) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.get_member_password_status(text) from public, anon, authenticated;
grant execute on function public.get_member_password_status(text) to service_role;
