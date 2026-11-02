# Daraja data import

The API includes a dry-run-first importer for the member roster and dated lesson attendance exports.

## What it imports

- The member spreadsheet's first worksheet is treated as the active roster.
- `ALPHONCE AKILENG` and `Fatma Namanda Webbo` are excluded from active users.
- Remaining roster members are created or matched as inactive `student` Auth users without invitations.
- Lesson documents become completed online training sessions and historical meetings.
- Attendance names are normalized against the roster. Unresolved labels are reported and never assigned automatically.

## Dry run

Run from the repository root:

```bash
npm run import:data --workspace @daraja/api -- \
  --members "/path/to/members.xlsx" \
  --attendance="/path/to/lesson-1.docx" \
  --attendance="/path/to/lesson-2.docx" \
  --attendance="/path/to/lesson-3.docx"
```

The dry run prints the active member count, lesson dates, matched attendance rows, and unresolved labels. Review this output before applying.

## Apply

After applying the latest Supabase migrations and reviewing the dry-run output:

```bash
npm run import:data --workspace @daraja/api -- \
  --members "/path/to/members.xlsx" \
  --attendance="/path/to/lesson-1.docx" \
  --attendance="/path/to/lesson-2.docx" \
  --attendance="/path/to/lesson-3.docx" \
  --apply
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be available to the API process. The service-role key is server-only and must never be placed in the web application's environment.

The import is designed to be rerunnable. It does not set passwords or send invitations; an administrator must activate and provision the imported accounts separately.
