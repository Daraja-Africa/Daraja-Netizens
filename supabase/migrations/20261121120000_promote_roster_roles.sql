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
