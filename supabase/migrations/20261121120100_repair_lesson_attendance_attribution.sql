-- Repair historical lesson attendance that was attributed to the wrong member.
--
-- The attendance importer used to trust the document's Email column over the
-- display name. Some exports repeat the meeting host's email in every row, so a
-- lesson's rows could be written against the host instead of the attendee. The
-- importer now lets a clear display-name match win, and this migration re-points
-- the rows that were already written.
--
-- `source_label` keeps the name the export used, so it is the reliable identity
-- for an imported row. Only rows that resolve to a different member are moved;
-- rows whose label matches no member (guests, the trainer) are left untouched.
-- A row that would collide with an existing record for the same meeting is
-- dropped only after the target record is known to be present.

drop table if exists attendance_repair_map;

create temporary table attendance_repair_map as
with labeled as (
  select a.id,
         a.user_id,
         a.meeting_id,
         lower(trim(regexp_replace(
           regexp_replace(
             regexp_replace(a.source_label, '\([^)]*\)', ' ', 'g'),
             '[^A-Za-z0-9 ]', ' ', 'g'),
           '[[:space:]]+', ' ', 'g'))) as label_key
  from public.attendance_logs a
  where a.source = 'historical_import'
    and a.source_label is not null
    and trim(a.source_label) <> ''
),
-- The historical display names from the seed migration. This map is fixed with
-- the source documents, so it stays trustworthy even if the same bug also
-- overwrote member_aliases while importing.
trusted_alias (alias_key, email) as (
  values
  ('angel chesoni', 'chesoni.belinda@gmail.com'),
  ('armstrong ouma', 'armstrongouma28@gmail.com'),
  ('barrack alusa', 'barrackalusa@gmail.com'),
  ('basma issack', 'issackbasma@gmail.com'),
  ('benedict felicity', 'benedictfelicity7@gmail.com'),
  ('betty', 'b3877901@gmail.com'),
  ('brian milo', 'brian.miloh@gmail.com'),
  ('christelle hope', 'christellehope.ella@gmail.com'),
  ('elsie wanjiru', 'elsiewmunge@gmail.com'),
  ('felly', 'fellydestiny@gmail.com'),
  ('hope christelle', 'christellehope.ella@gmail.com'),
  ('hope kuria', 'hopekuria06@gmail.com'),
  ('hope ndanu', 'hopendanu283@gmail.com'),
  ('iteyo khaisia', 'iteyokhaisia@gmail.com'),
  ('ivan', 'ivanrayodundo@gmail.com'),
  ('keisha nyawira', 'keishanyawira@gmail.com'),
  ('keisha wahome', 'keishanyawira@gmail.com'),
  ('lavette noelah', 'lavettenoelah@gmail.com'),
  ('michelle awuor', 'awuormichelle07@gmail.com'),
  ('miguel', 'miguellewis575@gmail.com'),
  ('mukambi soita', 'soitamukambi@gmail.com'),
  ('natalie akinyi', 'berthaonyango23@gmail.com'),
  ('natalie mwende', 'mwende.natalie06@gmail.com'),
  ('neema mwangi', 'neemakmwangi@gmail.com'),
  ('olive gala', 'tuniezei@gmail.com'),
  ('pepetual', 'wigwa9657@gmail.com'),
  ('reson', 'resonhilda@gmail.com'),
  ('ryan gathua', 'gathuaryan67@gmail.com'),
  ('samuel misiani', 'misianimakori@gmail.com'),
  ('selina', 'selinawferuzi@gmail.com'),
  ('tandy', 'mariwa.tandy@gmail.com'),
  ('whitney', 'whitmakambi@gmail.com'),
  ('zei tunie', 'tuniezei@gmail.com')
),
trusted_match as (
  select l.id, u.id as member_id, 1 as priority
  from labeled l
  join trusted_alias t on t.alias_key = l.label_key
  join public.users u on lower(u.email) = lower(t.email)
),
name_match as (
  select l.id, u.id as member_id, 2 as priority
  from labeled l
  join public.users u
    on lower(trim(regexp_replace(
         regexp_replace(
           regexp_replace(u.full_name, '\([^)]*\)', ' ', 'g'),
           '[^A-Za-z0-9 ]', ' ', 'g'),
         '[[:space:]]+', ' ', 'g'))) = l.label_key
),
alias_match as (
  select l.id, ma.member_id, 3 as priority
  from labeled l
  join public.member_aliases ma on ma.alias_key = l.label_key
),
matches as (
  select id, member_id, priority from trusted_match
  union all
  select id, member_id, priority from name_match
  union all
  select id, member_id, priority from alias_match
)
select distinct on (m.id) m.id, l.user_id, l.meeting_id, m.member_id
from matches m
join labeled l on l.id = m.id
order by m.id, m.priority;

-- Clear a zero-presence placeholder at the target so the repaired row can take
-- its place under the unique (meeting_id, user_id) index.
delete from public.attendance_logs b
using attendance_repair_map r
where r.user_id <> r.member_id
  and b.meeting_id = r.meeting_id
  and b.user_id = r.member_id
  and b.id <> r.id
  and b.presence_seconds <= 0;

update public.attendance_logs a
set user_id = r.member_id
from attendance_repair_map r
where a.id = r.id
  and a.user_id <> r.member_id
  and (
    a.meeting_id is null
    or not exists (
      select 1
      from public.attendance_logs b
      where b.meeting_id = a.meeting_id
        and b.user_id = r.member_id
        and b.id <> a.id
    )
  );

-- The target already has a present record for this meeting; the misattributed
-- row is a duplicate of it.
delete from public.attendance_logs a
using attendance_repair_map r
where a.id = r.id
  and a.user_id <> r.member_id
  and a.meeting_id is not null
  and exists (
    select 1
    from public.attendance_logs b
    where b.meeting_id = a.meeting_id
      and b.user_id = r.member_id
      and b.id <> a.id
  );

drop table if exists attendance_repair_map;
