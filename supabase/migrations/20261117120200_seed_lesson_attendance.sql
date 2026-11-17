-- Lesson attendance from the four dated attendance documents:
--   Lesson 1  13 Oct 2026  bsx-geqp-zhu
--   Lesson 2  20 Oct 2026  fbw-vvcs-avv
--   Lesson 3  27 Oct 2026  uqj-ubwy-rhe
--   Lesson 4  03 Nov 2026  gwt-hmym-zpi
--
-- Each lesson becomes a completed online training session (required for
-- training, not for stipend) plus the historical meeting it was captured from.
-- Attendance is written as one row per member per lesson and keeps the display
-- name the export used. Re-runnable: sessions match on (title, scheduled_at),
-- meetings on room_key, aliases on alias_key, and an attendance row is only
-- inserted when that member has none for the session yet.

insert into public.training_sessions
  (title, session_type, scheduled_at, status, required_for_training, required_for_stipend, week_key)
select title, 'online', scheduled_at, 'completed', true, false, week_key
from (values
  (1, 'Lesson 1 — Facilitator Training', '2026-10-13T12:00:00Z'::timestamptz, 'week-1', 'bsx-geqp-zhu'),
  (2, 'Lesson 2 — Facilitator Training', '2026-10-20T12:00:00Z'::timestamptz, 'week-2', 'fbw-vvcs-avv'),
  (3, 'Lesson 3 — Facilitator Training', '2026-10-27T12:00:00Z'::timestamptz, 'week-3', 'uqj-ubwy-rhe'),
  (4, 'Lesson 4 — Facilitator Training', '2026-11-03T12:00:00Z'::timestamptz, 'week-4', 'gwt-hmym-zpi')
) as lessons (week, title, scheduled_at, week_key, meeting_code)
on conflict (title, scheduled_at) do update set
  session_type = excluded.session_type,
  status = excluded.status,
  required_for_training = excluded.required_for_training,
  required_for_stipend = excluded.required_for_stipend,
  week_key = excluded.week_key;

insert into public.meetings (room_key, title, scheduled_start, status, meeting_type)
select meeting_code, title, scheduled_at, 'completed', 'online'
from (values
  (1, 'Lesson 1 — Facilitator Training', '2026-10-13T12:00:00Z'::timestamptz, 'week-1', 'bsx-geqp-zhu'),
  (2, 'Lesson 2 — Facilitator Training', '2026-10-20T12:00:00Z'::timestamptz, 'week-2', 'fbw-vvcs-avv'),
  (3, 'Lesson 3 — Facilitator Training', '2026-10-27T12:00:00Z'::timestamptz, 'week-3', 'uqj-ubwy-rhe'),
  (4, 'Lesson 4 — Facilitator Training', '2026-11-03T12:00:00Z'::timestamptz, 'week-4', 'gwt-hmym-zpi')
) as lessons (week, title, scheduled_at, week_key, meeting_code)
on conflict (room_key) do update set
  title = excluded.title,
  scheduled_start = excluded.scheduled_start,
  status = excluded.status,
  meeting_type = excluded.meeting_type;

-- Member attendance for the four lessons. A person can appear twice in one
-- export under two display names (Lesson 1 lists both "Keisha Nyawira" and
-- "Keisha Wahome"), so the rows are collapsed to one per member per lesson.
with seen (meeting_code, email, source_label) as (
  values
  ('bsx-geqp-zhu', 'armonkiprotich@gmail.com', 'Armon Kiprotich'),
  ('bsx-geqp-zhu', 'armstrongouma28@gmail.com', 'Armstrong Ouma'),
  ('bsx-geqp-zhu', 'issackbasma@gmail.com', 'Basma Issack (Meeting host)'),
  ('bsx-geqp-zhu', 'benedictfelicity7@gmail.com', 'Benedict Felicity'),
  ('bsx-geqp-zhu', 'b3877901@gmail.com', 'Betty'),
  ('bsx-geqp-zhu', 'charlesotsyula65@gmail.com', 'Charles Otsyula'),
  ('bsx-geqp-zhu', 'ashitsachelsea@gmail.com', 'Chelsea Ashitsa'),
  ('bsx-geqp-zhu', 'elsiewmunge@gmail.com', 'Elsie Wanjiru'),
  ('bsx-geqp-zhu', 'fellydestiny@gmail.com', 'felly (You)'),
  ('bsx-geqp-zhu', 'hamiltonmwaila06@gmail.com', 'Hamilton Mwaila'),
  ('bsx-geqp-zhu', 'christellehope.ella@gmail.com', 'hope Christelle'),
  ('bsx-geqp-zhu', 'hopekuria06@gmail.com', 'Hope Kuria'),
  ('bsx-geqp-zhu', 'hopendanu283@gmail.com', 'Hope Ndanu'),
  ('bsx-geqp-zhu', 'ivanrayodundo@gmail.com', 'Ivan'),
  ('bsx-geqp-zhu', 'keishanyawira@gmail.com', 'Keisha Nyawira'),
  ('bsx-geqp-zhu', 'keishanyawira@gmail.com', 'Keisha Wahome'),
  ('bsx-geqp-zhu', 'gitongakeziah21@gmail.com', 'Keziah Gitonga'),
  ('bsx-geqp-zhu', 'lavettenoelah@gmail.com', 'Lavette Noelah'),
  ('bsx-geqp-zhu', 'awuormichelle07@gmail.com', 'Michelle Awuor'),
  ('bsx-geqp-zhu', 'miguellewis575@gmail.com', 'Miguel'),
  ('bsx-geqp-zhu', 'soitamukambi@gmail.com', 'Mukambi Soita'),
  ('bsx-geqp-zhu', 'mwende.natalie06@gmail.com', 'Natalie Mwende'),
  ('bsx-geqp-zhu', 'neemakmwangi@gmail.com', 'Neema Mwangi'),
  ('bsx-geqp-zhu', 'wigwa9657@gmail.com', 'Pepetual'),
  ('bsx-geqp-zhu', 'resonhilda@gmail.com', 'Reson'),
  ('bsx-geqp-zhu', 'gathuaryan67@gmail.com', 'Ryan gathua'),
  ('bsx-geqp-zhu', 'selinawferuzi@gmail.com', 'Selina'),
  ('bsx-geqp-zhu', 'mariwa.tandy@gmail.com', 'Tandy'),
  ('bsx-geqp-zhu', 'nyoherovicky@gmail.com', 'Vicky Nyohero'),
  ('bsx-geqp-zhu', 'mwangivictorywanjugu@gmail.com', 'Victory Mwangi'),
  ('bsx-geqp-zhu', 'whitmakambi@gmail.com', 'Whitney'),
  ('bsx-geqp-zhu', 'tuniezei@gmail.com', 'Zei Tunie'),
  ('fbw-vvcs-avv', 'armonkiprotich@gmail.com', 'Armon Kiprotich'),
  ('fbw-vvcs-avv', 'armstrongouma28@gmail.com', 'Armstrong Ouma'),
  ('fbw-vvcs-avv', 'barrackalusa@gmail.com', 'Barrack Alusa'),
  ('fbw-vvcs-avv', 'benedictfelicity7@gmail.com', 'Benedict Felicity'),
  ('fbw-vvcs-avv', 'b3877901@gmail.com', 'Betty'),
  ('fbw-vvcs-avv', 'charlesotsyula65@gmail.com', 'Charles Otsyula'),
  ('fbw-vvcs-avv', 'ashitsachelsea@gmail.com', 'Chelsea Ashitsa'),
  ('fbw-vvcs-avv', 'christellehope.ella@gmail.com', 'Christelle Hope'),
  ('fbw-vvcs-avv', 'elsiewmunge@gmail.com', 'Elsie Wanjiru'),
  ('fbw-vvcs-avv', 'esthernganyi9@gmail.com', 'Esther Nganyi'),
  ('fbw-vvcs-avv', 'fellydestiny@gmail.com', 'felly (You)'),
  ('fbw-vvcs-avv', 'hopekuria06@gmail.com', 'Hope Kuria'),
  ('fbw-vvcs-avv', 'hopendanu283@gmail.com', 'Hope Ndanu'),
  ('fbw-vvcs-avv', 'iteyokhaisia@gmail.com', 'Iteyo Khaisia'),
  ('fbw-vvcs-avv', 'keishanyawira@gmail.com', 'Keisha Nyawira'),
  ('fbw-vvcs-avv', 'gitongakeziah21@gmail.com', 'Keziah Gitonga'),
  ('fbw-vvcs-avv', 'awuormichelle07@gmail.com', 'Michelle Awuor'),
  ('fbw-vvcs-avv', 'miguellewis575@gmail.com', 'Miguel'),
  ('fbw-vvcs-avv', 'berthaonyango23@gmail.com', 'Natalie Akinyi'),
  ('fbw-vvcs-avv', 'mwende.natalie06@gmail.com', 'Natalie Mwende'),
  ('fbw-vvcs-avv', 'neemakmwangi@gmail.com', 'Neema Mwangi'),
  ('fbw-vvcs-avv', 'tuniezei@gmail.com', 'Olive Gala'),
  ('fbw-vvcs-avv', 'wigwa9657@gmail.com', 'Pepetual'),
  ('fbw-vvcs-avv', 'resonhilda@gmail.com', 'Reson'),
  ('fbw-vvcs-avv', 'gathuaryan67@gmail.com', 'Ryan gathua'),
  ('fbw-vvcs-avv', 'mulatiryan75@gmail.com', 'Ryan Mulati'),
  ('fbw-vvcs-avv', 'misianimakori@gmail.com', 'Samuel Misiani'),
  ('fbw-vvcs-avv', 'mariwa.tandy@gmail.com', 'Tandy'),
  ('fbw-vvcs-avv', 'mwangivictorywanjugu@gmail.com', 'Victory Mwangi'),
  ('fbw-vvcs-avv', 'whitmakambi@gmail.com', 'Whitney'),
  ('uqj-ubwy-rhe', 'issackbasma@gmail.com', 'Basma Issack (You)'),
  ('uqj-ubwy-rhe', 'benedictfelicity7@gmail.com', 'Benedict Felicity'),
  ('uqj-ubwy-rhe', 'b3877901@gmail.com', 'Betty'),
  ('uqj-ubwy-rhe', 'brian.miloh@gmail.com', 'Brian Milo'),
  ('uqj-ubwy-rhe', 'charlesotsyula65@gmail.com', 'Charles Otsyula'),
  ('uqj-ubwy-rhe', 'ashitsachelsea@gmail.com', 'Chelsea Ashitsa'),
  ('uqj-ubwy-rhe', 'christellehope.ella@gmail.com', 'Christelle Hope'),
  ('uqj-ubwy-rhe', 'elsiewmunge@gmail.com', 'Elsie Wanjiru'),
  ('uqj-ubwy-rhe', 'esthernganyi9@gmail.com', 'Esther Nganyi'),
  ('uqj-ubwy-rhe', 'gloriahadassah58@gmail.com', 'Gloria Hadassah'),
  ('uqj-ubwy-rhe', 'hopekuria06@gmail.com', 'Hope Kuria'),
  ('uqj-ubwy-rhe', 'hopendanu283@gmail.com', 'Hope Ndanu'),
  ('uqj-ubwy-rhe', 'ivanrayodundo@gmail.com', 'Ivan'),
  ('uqj-ubwy-rhe', 'keishanyawira@gmail.com', 'Keisha Wahome'),
  ('uqj-ubwy-rhe', 'gitongakeziah21@gmail.com', 'Keziah Gitonga'),
  ('uqj-ubwy-rhe', 'awuormichelle07@gmail.com', 'Michelle Awuor'),
  ('uqj-ubwy-rhe', 'soitamukambi@gmail.com', 'Mukambi Soita'),
  ('uqj-ubwy-rhe', 'mwende.natalie06@gmail.com', 'Natalie Mwende'),
  ('uqj-ubwy-rhe', 'wigwa9657@gmail.com', 'Pepetual'),
  ('uqj-ubwy-rhe', 'resonhilda@gmail.com', 'Reson'),
  ('uqj-ubwy-rhe', 'mariwa.tandy@gmail.com', 'Tandy'),
  ('uqj-ubwy-rhe', 'mwangivictorywanjugu@gmail.com', 'Victory Mwangi'),
  ('uqj-ubwy-rhe', 'whitmakambi@gmail.com', 'Whitney'),
  ('gwt-hmym-zpi', 'chesoni.belinda@gmail.com', 'Angel chesoni'),
  ('gwt-hmym-zpi', 'armstrongouma28@gmail.com', 'Armstrong Ouma'),
  ('gwt-hmym-zpi', 'issackbasma@gmail.com', 'Basma Issack'),
  ('gwt-hmym-zpi', 'benedictfelicity7@gmail.com', 'Benedict Felicity'),
  ('gwt-hmym-zpi', 'b3877901@gmail.com', 'Betty'),
  ('gwt-hmym-zpi', 'charlesotsyula65@gmail.com', 'Charles Otsyula'),
  ('gwt-hmym-zpi', 'christellehope.ella@gmail.com', 'Christelle Hope'),
  ('gwt-hmym-zpi', 'esthernganyi9@gmail.com', 'Esther Nganyi'),
  ('gwt-hmym-zpi', 'fellydestiny@gmail.com', 'felly'),
  ('gwt-hmym-zpi', 'gloriahadassah58@gmail.com', 'Gloria Hadassah'),
  ('gwt-hmym-zpi', 'hamiltonmwaila06@gmail.com', 'Hamilton Mwaila'),
  ('gwt-hmym-zpi', 'hopekuria06@gmail.com', 'Hope Kuria'),
  ('gwt-hmym-zpi', 'hopendanu283@gmail.com', 'Hope Ndanu'),
  ('gwt-hmym-zpi', 'ivanrayodundo@gmail.com', 'Ivan'),
  ('gwt-hmym-zpi', 'keishanyawira@gmail.com', 'Keisha Nyawira'),
  ('gwt-hmym-zpi', 'lavettenoelah@gmail.com', 'Lavette Noelah'),
  ('gwt-hmym-zpi', 'awuormichelle07@gmail.com', 'Michelle Awuor'),
  ('gwt-hmym-zpi', 'miguellewis575@gmail.com', 'Miguel'),
  ('gwt-hmym-zpi', 'soitamukambi@gmail.com', 'Mukambi Soita'),
  ('gwt-hmym-zpi', 'mwende.natalie06@gmail.com', 'Natalie Mwende'),
  ('gwt-hmym-zpi', 'neemakmwangi@gmail.com', 'Neema Mwangi')
),
per_member as (
  select distinct on (meeting_code, lower(email))
    meeting_code, lower(email) as email, source_label
  from seen
  order by meeting_code, lower(email), source_label
)
insert into public.attendance_logs
  (meeting_id, session_id, user_id, joined_at, left_at, presence_seconds, source, source_label)
select m.id, s.id, u.id, m.scheduled_start, m.scheduled_start, 1, 'historical_import', per_member.source_label
from per_member
join public.meetings m on m.room_key = per_member.meeting_code
join public.training_sessions s on s.scheduled_at = m.scheduled_start and s.title = m.title
join public.users u on lower(u.email) = per_member.email
where not exists (
  select 1
  from public.attendance_logs a
  where a.session_id = s.id and a.user_id = u.id
);

-- Display names that resolve to a roster member, so a later upload matches them
-- without a human.
with alias_map (alias, alias_key, email) as (
  values
  ('angel chesoni', 'angel chesoni', 'chesoni.belinda@gmail.com'),
  ('armstrong ouma', 'armstrong ouma', 'armstrongouma28@gmail.com'),
  ('barrack alusa', 'barrack alusa', 'barrackalusa@gmail.com'),
  ('basma issack', 'basma issack', 'issackbasma@gmail.com'),
  ('benedict felicity', 'benedict felicity', 'benedictfelicity7@gmail.com'),
  ('betty', 'betty', 'b3877901@gmail.com'),
  ('brian milo', 'brian milo', 'brian.miloh@gmail.com'),
  ('christelle hope', 'christelle hope', 'christellehope.ella@gmail.com'),
  ('elsie wanjiru', 'elsie wanjiru', 'elsiewmunge@gmail.com'),
  ('felly', 'felly', 'fellydestiny@gmail.com'),
  ('hope christelle', 'hope christelle', 'christellehope.ella@gmail.com'),
  ('hope kuria', 'hope kuria', 'hopekuria06@gmail.com'),
  ('hope ndanu', 'hope ndanu', 'hopendanu283@gmail.com'),
  ('iteyo khaisia', 'iteyo khaisia', 'iteyokhaisia@gmail.com'),
  ('ivan', 'ivan', 'ivanrayodundo@gmail.com'),
  ('keisha nyawira', 'keisha nyawira', 'keishanyawira@gmail.com'),
  ('keisha wahome', 'keisha wahome', 'keishanyawira@gmail.com'),
  ('lavette noelah', 'lavette noelah', 'lavettenoelah@gmail.com'),
  ('michelle awuor', 'michelle awuor', 'awuormichelle07@gmail.com'),
  ('miguel', 'miguel', 'miguellewis575@gmail.com'),
  ('mukambi soita', 'mukambi soita', 'soitamukambi@gmail.com'),
  ('natalie akinyi', 'natalie akinyi', 'berthaonyango23@gmail.com'),
  ('natalie mwende', 'natalie mwende', 'mwende.natalie06@gmail.com'),
  ('neema mwangi', 'neema mwangi', 'neemakmwangi@gmail.com'),
  ('olive gala', 'olive gala', 'tuniezei@gmail.com'),
  ('pepetual', 'pepetual', 'wigwa9657@gmail.com'),
  ('reson', 'reson', 'resonhilda@gmail.com'),
  ('ryan gathua', 'ryan gathua', 'gathuaryan67@gmail.com'),
  ('samuel misiani', 'samuel misiani', 'misianimakori@gmail.com'),
  ('selina', 'selina', 'selinawferuzi@gmail.com'),
  ('tandy', 'tandy', 'mariwa.tandy@gmail.com'),
  ('whitney', 'whitney', 'whitmakambi@gmail.com'),
  ('zei tunie', 'zei tunie', 'tuniezei@gmail.com')
)
insert into public.member_aliases (member_id, alias, alias_key, source)
select u.id, alias_map.alias, alias_map.alias_key, 'historical_import'
from alias_map
join public.users u on lower(u.email) = lower(alias_map.email)
on conflict (alias_key) do update set
  member_id = excluded.member_id,
  alias = excluded.alias;

-- Names that matched no member, kept for review in the facilitator Data screen.
-- ALPHONCE AKILENG is recorded as ignored because he is excluded from membership,
-- and the "Ask A Counselor" entries are the trainer who hosted the session.
with unmatched (meeting_code, display_name, display_key, role_note, resolution) as (
  values
  ('bsx-geqp-zhu', 'ALPHONCE AKILENG', 'alphonce akileng', 'Excluded: not on the member roster', 'ignored'),
  ('bsx-geqp-zhu', 'Mr Mittens', 'mr mittens', 'Unmatched display name', 'pending'),
  ('bsx-geqp-zhu', 'Sheila Ngumi Ask A Counselor', 'sheila ngumi ask a counselor', 'Meeting host / trainer', 'pending'),
  ('fbw-vvcs-avv', 'Mposi Domnick O.', 'mposi domnick o', 'Unmatched display name', 'pending'),
  ('fbw-vvcs-avv', 'Sheila Ngumi Ask A Counselor (Meeting host)', 'sheila ngumi ask a counselor', 'Meeting host / trainer', 'pending'),
  ('uqj-ubwy-rhe', 'Mposi Domnick O.', 'mposi domnick o', 'Unmatched display name', 'pending'),
  ('uqj-ubwy-rhe', 'Sheila Ngumi Ask A Counselor KE (Meeting host)', 'sheila ngumi ask a counselor ke', 'Meeting host / trainer', 'pending'),
  ('gwt-hmym-zpi', 'K K', 'k k', 'Unmatched display name', 'pending'),
  ('gwt-hmym-zpi', 'Sheila Ngumi Ask A Counselor', 'sheila ngumi ask a counselor', 'Meeting host / trainer', 'pending')
)
insert into public.attendance_unmatched_entries
  (session_id, display_name, display_key, role_note, resolution)
select s.id, unmatched.display_name, unmatched.display_key, unmatched.role_note, unmatched.resolution
from unmatched
join public.meetings m on m.room_key = unmatched.meeting_code
join public.training_sessions s on s.scheduled_at = m.scheduled_start and s.title = m.title
on conflict (session_id, display_key) do nothing;
