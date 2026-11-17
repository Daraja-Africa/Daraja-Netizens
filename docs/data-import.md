# Daraja member and lesson data

How the facilitator roster and the four dated lesson attendance records are
normalized into the app, and how to apply the migrations that carry them.

## What the data becomes

| Source | Becomes |
| --- | --- |
| `Untitledspreadsheet.xlsx` Sheet 1 (44 rows) | 43 rows in `public.users` tagged `source = 'daraja-member-roster'`, with `national_id`, `phone`, `member_code` |
| `Untitledspreadsheet.xlsx` Sheet 2 | `cohort` on each member: 29 in **Pioneer Group**, 14 in **Cohort 1** |
| Lesson documents 1–4 | 4 `training_sessions` (completed, online, required for training) plus the `meetings` row for each Google Meet code |
| Attendance names | 105 `attendance_logs` rows (`source = 'historical_import'`), one per member per lesson |
| Display names like “Betty”, “Zei Tunie” | 33 `member_aliases` rows, reused automatically by later imports |
| Unmatched / excluded names | 9 `attendance_unmatched_entries` rows kept for review |

Attendance rows per lesson: Lesson 1 = 31, Lesson 2 = 30, Lesson 3 = 23,
Lesson 4 = 21. Lesson 1 lists Keisha twice (“Keisha Nyawira” and “Keisha
Wahome”), so the export's 32 matched entries collapse to 31 members.

**Excluded people:** Fatma Namanda Webbo is on the roster sheet and ALPHONCE
AKILENG appears in the Lesson 1 export. Neither is created as a member. Their
attendance lines are recorded as `ignored` review entries instead of being
silently dropped.

**Names to review** (not on the roster, so no member is invented): `Mr Mittens`
(Lesson 1), `Mposi Domnick O.` (Lessons 2 and 3), `K K` (Lesson 4), and the
trainer hosting each session (`Sheila Ngumi Ask A Counselor…`).

## Migration order

Migrations apply in filename (version) order. `supabase db push` does this for
you and skips versions the project already has.

**Already applied on the linked project** — listed so the order is explicit:

1. `20261009201701_create_meeting_persistence.sql` (history placeholder)
2. `20261009201833_add_attendance_unique_key.sql` (history placeholder)
3. `20261026165415_init_daraja_schema.sql`
4. `20261026165422_enable_deny_by_default_rls.sql`
5. `20261028125930_modules_attendance_content.sql` (history placeholder)
6. `20261028130009_training_session_eligibility.sql`
7. `20261028130037_expand_user_roles.sql`
8. `20261028150000_modules_attendance_content.sql`
9. `20261102093000_add_member_profile_fields.sql`
10. `20261117000000_student_reach_out.sql`

**New for this data**, in this order:

11. `20261117120000_attendance_import_schema.sql` — adds `users.member_code`,
    `users.cohort`, `attendance_logs.source_label`, and the `member_aliases` and
    `attendance_unmatched_entries` tables (RLS enabled, no browser access).
12. `20261117120100_seed_member_roster.sql` — the 43 members and their cohorts.
13. `20261117120200_seed_lesson_attendance.sql` — the 4 lessons, 4 meetings, 105
    attendance rows, 33 aliases and 9 review entries.
14. `20261117120300_sync_auth_users_to_seeded_profiles.sql` — links a Google
    sign-in to the seeded profile that owns the same email. The
    `auth.users` trigger and its one-time backfill move the profile and every
    row that references it (`attendance_logs.user_id`, `telemetry_events.user_id`,
    `meetings.host_id`, `qr_challenges`, `member_aliases`,
    `attendance_unmatched_entries`) from the placeholder uuid to the Auth uuid.
    Emails that are not on the roster are left alone, so no profile is invented.
    This must run **after** the roster seed, or the backfill has nothing to match.

Every statement is additive and idempotent: sessions match on
`(title, scheduled_at)`, meetings on `room_key`, members on `email`, aliases on
`alias_key`, and attendance is only inserted when that member has no row for the
session. Running them twice is safe.

### Option A — Supabase CLI (recommended)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`db push` runs only the pending versions, in order. To target a database without
linking:

```bash
npx supabase db push --db-url "postgresql://postgres:<db-password>@db.<project-ref>.supabase.co:5432/postgres"
```

### Option B — SQL editor or psql

New project: run every file in the list above in order.

Existing project (the linked one): run only the migrations it is missing, in
order — 11–13 for the roster and lesson data, then 14 for the sign-in sync.

```bash
for f in supabase/migrations/20261117120000_attendance_import_schema.sql \
         supabase/migrations/20261117120100_seed_member_roster.sql \
         supabase/migrations/20261117120200_seed_lesson_attendance.sql \
         supabase/migrations/20261117120300_sync_auth_users_to_seeded_profiles.sql; do
  psql "postgresql://postgres:<db-password>@db.<project-ref>.supabase.co:5432/postgres" -v ON_ERROR_STOP=1 -f "$f"
done
```

In the dashboard SQL editor, paste and run each file in the same order, waiting
for each to finish before starting the next.

### Verify

```sql
select count(*) from public.users where source = 'daraja-member-roster';            -- 43
select count(*) from public.users where lower(email) = 'fatmawebbo@gmail.com';      -- 0
select cohort, count(*) from public.users where member_code is not null group by 1; -- Pioneer Group 29, Cohort 1 14
select title, to_char(scheduled_at, 'YYYY-MM-DD') from public.training_sessions order by scheduled_at; -- 4 lessons
select s.title, count(*)
  from public.attendance_logs a
  join public.training_sessions s on s.id = a.session_id
 group by 1 order by 1;                                                             -- 31 / 30 / 23 / 21
select count(*) from public.member_aliases;                                         -- 33
select count(*) from public.attendance_unmatched_entries;                            -- 9

-- after a member signs in with Google their profile id equals their Auth id
select a.email, u.id = a.id as linked_to_auth
  from auth.users a
  join public.users u on lower(u.email) = lower(a.email);                           -- linked_to_auth = t
select count(*) from public.users u
 where u.source = 'daraja-member-roster'
   and u.id not in (select id from auth.users);                                     -- placeholders not signed in yet
```

Then open **Attendance data** in the facilitator dashboard (`/facilitator/data`):
the roster, the four lessons and the review list appear, searchable by name,
email, phone or cohort.

## Importing later exports in the app

Facilitator and admin accounts reach it from the **Data** tab or
`/facilitator/data`:

1. Choose **Lesson attendance (.docx)** or **Member roster (.xlsx)**.
2. Select the file(s) and press **Preview**. The preview lists who is new, who is
   already in the app, who is excluded, and which display names have no roster
   match. Previewing writes nothing.
3. Press **Confirm import** to write the approved batch.

Names are resolved in this order: the document's own email column, then its
official member name column, then an alias saved by an earlier import, then the
built-in alias map, then an exact roster name. Excluded people are never
created. Unmatched names are stored for review rather than guessed into the
roster, and confirming needs the migrations above.

## Importing from the terminal

```bash
npm run import:data --workspace @daraja/api -- \
  --members "Untitledspreadsheet.xlsx" \
  --attendance="Lesson 1.docx" --attendance="Lesson 2.docx" \
  --attendance="Lesson 3.docx" --attendance="Lesson 4.docx"
```

That is a dry run: it prints the roster delta, per-lesson matched/unmatched
counts and every name needing review. Add `--apply` to write, after applying the
migrations. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are read from the API
environment; the service-role key stays server-side.

The importer does not create Auth accounts or send invitations. Roster rows are
`public.users` records with `role = 'student'` and `status = 'active'`, matched
by email, so a person who later signs in with the same address keeps the same
membership record.
