-- Every roster member is a facilitator; the Student Portal needs no sign-in, so
-- there is no "student" base role any more. Admins keep their role.
--
-- The roster seed and the member importer now create facilitators, and this
-- migration brings existing rows onto the same model.

alter table public.users
  alter column role set default 'facilitator';

update public.users
   set role = 'facilitator'
 where role = 'student';

-- Explicit staff role assignments. Admin accounts retain facilitator access
-- through the application role guards; Sheila is host-only and must never be
-- assigned facilitator access.
with staff_assignments (email, role) as (
  values
  ('miguellewis575@gmail.com', 'admin'),
  ('issackbasma@gmail.com', 'admin'),
  ('iteyokhaisia@gmail.com', 'admin'),
  ('fellydestiny@gmail.com', 'admin'),
  ('christellehope.ella@gmail.com', 'admin')
)
update public.users u
   set role = a.role
  from staff_assignments a
 where lower(trim(u.email)) = a.email;

update public.users
   set role = 'host'
 where lower(trim(full_name)) like 'sheila ngumi%';
