begin;

select plan(10);

create temporary table oauth_reconcile_test_data (
  case_name text primary key,
  seed_id uuid,
  auth_id uuid not null,
  seed_email text,
  auth_email text
);

insert into oauth_reconcile_test_data (case_name, seed_id, auth_id, seed_email, auth_email)
values
  (
    'existing',
    gen_random_uuid(),
    gen_random_uuid(),
    'oauth-reconcile-' || gen_random_uuid()::text || '@example.invalid',
    'auth-placeholder-' || gen_random_uuid()::text || '@example.invalid'
  ),
  (
    'new',
    gen_random_uuid(),
    gen_random_uuid(),
    'new-oauth-reconcile-' || gen_random_uuid()::text || '@example.invalid',
    null
  ),
  (
    'unrostered',
    null,
    gen_random_uuid(),
    'unrostered-' || gen_random_uuid()::text || '@example.invalid',
    null
  ),
  ('blank', null, gen_random_uuid(), null, null);

insert into public.users (id, email, full_name, role)
select seed_id, seed_email, 'Roster Profile', 'facilitator'
from oauth_reconcile_test_data
where case_name in ('existing', 'new');

insert into public.users (id, email, full_name, role)
select auth_id, auth_email, 'Existing Auth Profile', 'participant'
from oauth_reconcile_test_data
where case_name = 'existing';

select is(
  (
    select public.reconcile_seeded_profile(auth_id, seed_email, 'Auth Name')
    from oauth_reconcile_test_data
    where case_name = 'existing'
  ),
  (select auth_id from oauth_reconcile_test_data where case_name = 'existing'),
  'existing Auth profile reconciles to the roster email'
);

select is(
  (
    select count(*)::integer
    from public.users u
    join oauth_reconcile_test_data t on t.auth_id = u.id
    where t.case_name = 'existing' and u.email = t.seed_email
  ),
  1,
  'existing Auth profile owns the unique roster email'
);

select ok(
  not exists (
    select 1
    from public.users u
    join oauth_reconcile_test_data t on t.seed_id = u.id
    where t.case_name = 'existing'
  ),
  'old roster placeholder row is removed'
);

select is(
  (
    select u.full_name
    from public.users u
    join oauth_reconcile_test_data t on t.auth_id = u.id
    where t.case_name = 'existing'
  ),
  'Roster Profile',
  'roster profile data is preserved'
);

select is(
  (
    select public.reconcile_seeded_profile(auth_id, seed_email, 'OAuth Name')
    from oauth_reconcile_test_data
    where case_name = 'new'
  ),
  (select auth_id from oauth_reconcile_test_data where case_name = 'new'),
  'new Auth profile reconciles to the roster email'
);

select ok(
  exists (
    select 1
    from public.users u
    join oauth_reconcile_test_data t on t.auth_id = u.id
    where t.case_name = 'new'
      and u.email = t.seed_email
      and u.full_name = 'Roster Profile'
  ),
  'new Auth profile inherits the roster row'
);

select ok(
  not exists (
    select 1
    from public.users u
    join oauth_reconcile_test_data t on t.seed_id = u.id
    where t.case_name = 'new'
  ),
  'new profile old roster placeholder row is removed'
);

select is(
  (
    select public.reconcile_seeded_profile(auth_id, seed_email, null)
    from oauth_reconcile_test_data
    where case_name = 'unrostered'
  ),
  null::uuid,
  'unrostered email is not reconciled'
);

select ok(
  not exists (
    select 1
    from public.users u
    join oauth_reconcile_test_data t on t.auth_id = u.id
    where t.case_name = 'unrostered'
  ),
  'unrostered email does not create a profile'
);

select is(
  (
    select public.reconcile_seeded_profile(auth_id, seed_email, null)
    from oauth_reconcile_test_data
    where case_name = 'blank'
  ),
  null::uuid,
  'blank email is not reconciled'
);

select * from finish();

rollback;
