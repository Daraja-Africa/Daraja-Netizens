import { useEffect, useMemo, useState } from 'react';

import { ApiError, apiFetch } from '../api';
import './attendanceData.css';

type Member = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  cohort: string | null;
  member_code: string | null;
  status: string;
};

type Lesson = {
  id: string;
  title: string;
  scheduled_at: string;
  week_key: string | null;
  meeting_code: string | null;
  attendees: Array<{ name: string; display_name: string | null; cohort: string | null }>;
  unmatched: Array<{ display_name: string; role_note: string | null; resolution: string }>;
};

type Overview = {
  members: Member[];
  lessons: Lesson[];
  totals: { members: number; lessons: number; attendance: number; unmatched: number };
};

type MemberPreview = {
  kind: 'members';
  total: number;
  toCreate: string[];
  toUpdate: string[];
  skipped: Array<{ name: string; email: string; reason: string }>;
};

type LessonPreview = {
  kind: 'attendance';
  lessons: Array<{
    title: string;
    date: string;
    meetingCode: string;
    sourceFile: string;
    matched: number;
    unmatched: number;
    excluded: number;
    entries: Array<{ displayName: string; memberName: string | null; status: string }>;
  }>;
};

type Preview = MemberPreview | LessonPreview;

type ApplyResult =
  | { kind: 'members'; created: string[]; updated: string[]; excluded: string[] }
  | { kind: 'attendance'; lessons: Array<{ lesson: string; date: string; attendanceWritten: number; unmatched: number }> };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`${file.name} could not be read`));
    reader.readAsDataURL(file);
  });
}

export default function AttendanceData({ accessToken }: { accessToken: string | null }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [migrationDetail, setMigrationDetail] = useState('');
  const [query, setQuery] = useState('');
  const [cohort, setCohort] = useState('all');

  const [importKind, setImportKind] = useState<'members' | 'attendance'>('attendance');
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  async function loadOverview() {
    setLoadError('');
    try {
      const data: Overview = await apiFetch('/api/v1/facilitator/attendance/data', accessToken);
      setOverview(data);
      setMigrationDetail('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setMigrationDetail(typeof error.payload?.detail === 'string' ? error.payload.detail : '');
      } else {
        setLoadError(error instanceof Error ? error.message : 'Attendance data is unavailable');
      }
    }
  }

  useEffect(() => {
    void loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const cohorts = useMemo(
    () => [...new Set((overview?.members ?? []).map((member) => member.cohort).filter(Boolean) as string[])],
    [overview]
  );

  const filteredMembers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (overview?.members ?? []).filter((member) => {
      if (cohort !== 'all' && member.cohort !== cohort) return false;
      if (!term) return true;
      return [member.full_name, member.email, member.phone ?? '', member.cohort ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [overview, query, cohort]);

  function resetImport(nextKind: 'members' | 'attendance') {
    setImportKind(nextKind);
    setFiles([]);
    setPreview(null);
    setResult(null);
    setMessage('');
    setFileInputKey((value) => value + 1);
  }

  async function sendImport(action: 'preview' | 'apply') {
    if (!files.length) {
      setMessage('Choose a file first.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const payload = {
        kind: importKind,
        files: await Promise.all(files.map(async (file) => ({ name: file.name, data: await readFile(file) }))),
      };
      const data = await apiFetch(`/api/v1/facilitator/attendance/import/${action}`, accessToken, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (action === 'preview') {
        setPreview(data as Preview);
        setResult(null);
      } else {
        setResult(data as ApplyResult);
        setPreview(null);
        setFileInputKey((value) => value + 1);
        setFiles([]);
        await loadOverview();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setMigrationDetail(typeof error.payload?.detail === 'string' ? error.payload.detail : '');
      }
      setMessage(error instanceof Error ? error.message : 'The import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="data-page">
      <div className="metric-grid">
        <div className="metric-card"><span>Members</span><strong>{overview?.totals.members ?? '—'}</strong></div>
        <div className="metric-card"><span>Lessons</span><strong>{overview?.totals.lessons ?? '—'}</strong></div>
        <div className="metric-card"><span>Attendance records</span><strong>{overview?.totals.attendance ?? '—'}</strong></div>
        <div className="metric-card"><span>Names to review</span><strong>{overview?.totals.unmatched ?? '—'}</strong></div>
      </div>

      {loadError && <p className="error-text">{loadError}</p>}

      {migrationDetail && (
        <div className="feature-card data-notice">
          <div>
            <p className="viewer-kicker">Migrations required</p>
            <h3>The roster is not loaded into this database yet</h3>
            <p className="muted">
              Apply these migrations in order, then reload this screen. You can still preview an export below — previewing
              never writes anything.
            </p>
          </div>
          <ol className="data-steps">
            <li><code>supabase/migrations/20261117120000_attendance_import_schema.sql</code></li>
            <li><code>supabase/migrations/20261117120100_seed_member_roster.sql</code></li>
            <li><code>supabase/migrations/20261117120200_seed_lesson_attendance.sql</code></li>
          </ol>
          <p className="muted">{migrationDetail}</p>
        </div>
      )}

      <div className="feature-card data-import">
        <div>
          <p className="viewer-kicker">Bring in an export</p>
          <h3>Import roster or lesson attendance</h3>
          <p className="muted">
            Preview first: names are resolved against the roster, and the preview lists who is new, who is excluded and
            which display names need a decision. Nothing is written until you confirm.
          </p>
        </div>

        <div className="data-tabs" role="tablist" aria-label="Import type">
          <button
            type="button"
            role="tab"
            aria-selected={importKind === 'attendance'}
            className={importKind === 'attendance' ? 'data-tab active' : 'data-tab'}
            onClick={() => resetImport('attendance')}
          >
            Lesson attendance (.docx)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={importKind === 'members'}
            className={importKind === 'members' ? 'data-tab active' : 'data-tab'}
            onClick={() => resetImport('members')}
          >
            Member roster (.xlsx)
          </button>
        </div>

        <input
          key={fileInputKey}
          type="file"
          aria-label={importKind === 'members' ? 'Member roster spreadsheet' : 'Lesson attendance documents'}
          accept={importKind === 'members' ? '.xlsx,.xls' : '.docx'}
          multiple={importKind === 'attendance'}
          onChange={(event) => {
            setFiles(Array.from(event.target.files ?? []));
            setPreview(null);
            setResult(null);
            setMessage('');
          }}
        />

        <div className="data-actions">
          <button type="button" className="ghost-button" disabled={busy} onClick={() => void sendImport('preview')}>
            {busy ? 'Working…' : 'Preview'}
          </button>
          <button type="button" disabled={busy || !preview} onClick={() => void sendImport('apply')}>
            Confirm import
          </button>
        </div>
        {message && <p className="error-text">{message}</p>}

        {preview?.kind === 'members' && (
          <div className="data-preview">
            <p className="muted">
              {preview.total} member rows read · {preview.toCreate.length} new · {preview.toUpdate.length} already in the app
            </p>
            {preview.toCreate.length > 0 && <p><strong>New members:</strong> {preview.toCreate.join(', ')}</p>}
            {preview.skipped.length > 0 && (
              <p>
                <strong>Not added:</strong>{' '}
                {preview.skipped.map((row) => `${row.name || row.email} (${row.reason})`).join(', ')}
              </p>
            )}
          </div>
        )}

        {preview?.kind === 'attendance' && (
          <div className="data-preview">
            {preview.lessons.map((lesson) => (
              <div key={lesson.sourceFile} className="data-preview-lesson">
                <strong>{lesson.title}</strong>
                <span className="muted">
                  {formatDate(lesson.date)} · {lesson.matched} matched · {lesson.unmatched} to review
                  {lesson.excluded > 0 ? ` · ${lesson.excluded} excluded` : ''}
                </span>
                {lesson.entries.some((entry) => entry.status !== 'matched') && (
                  <ul className="data-review-list">
                    {lesson.entries
                      .filter((entry) => entry.status !== 'matched')
                      .map((entry) => (
                        <li key={`${lesson.sourceFile}-${entry.displayName}`}>
                          {entry.displayName} — {entry.status === 'excluded' ? 'excluded from membership' : 'no roster match'}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {result?.kind === 'members' && (
          <div className="data-preview">
            <p><strong>Roster saved.</strong> {result.created.length} added, {result.updated.length} updated.</p>
            {result.excluded.length > 0 && <p className="muted">Excluded: {result.excluded.join(', ')}</p>}
          </div>
        )}

        {result?.kind === 'attendance' && (
          <div className="data-preview">
            <p><strong>Attendance saved.</strong></p>
            <ul className="data-review-list">
              {result.lessons.map((lesson) => (
                <li key={lesson.lesson}>
                  {lesson.lesson} — {lesson.attendanceWritten} new records
                  {lesson.unmatched > 0 ? `, ${lesson.unmatched} kept for review` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {overview && (
        <div className="data-columns">
          <div className="feature-card">
            <div className="data-card-head">
              <div>
                <p className="viewer-kicker">Member roster</p>
                <h3>{filteredMembers.length} members</h3>
              </div>
            </div>
            <div className="data-filters">
              <input
                type="search"
                placeholder="Search name, email or phone"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search members"
              />
              <select value={cohort} onChange={(event) => setCohort(event.target.value)} aria-label="Filter by cohort">
                <option value="all">All cohorts</option>
                {cohorts.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <ul className="data-member-list">
              {filteredMembers.map((member) => (
                <li key={member.id}>
                  <div>
                    <strong>{member.full_name}</strong>
                    <span className="muted">{member.email}</span>
                  </div>
                  <div className="data-member-meta">
                    {member.cohort && <span className="data-tag">{member.cohort}</span>}
                    {member.phone && <span className="muted">{member.phone}</span>}
                  </div>
                </li>
              ))}
              {!filteredMembers.length && <li className="muted">No members match that search.</li>}
            </ul>
          </div>

          <div className="feature-card">
            <p className="viewer-kicker">Imported lessons</p>
            <h3>{overview.lessons.length} lessons</h3>
            <div className="data-lesson-list">
              {overview.lessons.map((lesson) => (
                <details key={lesson.id} className="data-lesson">
                  <summary>
                    <span>
                      <strong>{lesson.title}</strong>
                      <span className="muted">
                        {formatDate(lesson.scheduled_at)}
                        {lesson.meeting_code ? ` · ${lesson.meeting_code}` : ''}
                      </span>
                    </span>
                    <span className="data-count">{lesson.attendees.length}</span>
                  </summary>
                  <ul className="data-attendees">
                    {lesson.attendees.map((attendee) => (
                      <li key={`${lesson.id}-${attendee.name}-${attendee.display_name ?? ''}`}>
                        {attendee.name}
                        {attendee.display_name && attendee.display_name !== attendee.name && (
                          <span className="muted"> · seen as “{attendee.display_name}”</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {lesson.unmatched.length > 0 && (
                    <div className="data-review">
                      <strong>Needs review</strong>
                      <ul>
                        {lesson.unmatched.map((entry) => (
                          <li key={`${lesson.id}-${entry.display_name}`}>
                            {entry.display_name}
                            {entry.role_note ? ` — ${entry.role_note}` : ''}
                            {entry.resolution === 'ignored' ? ' (excluded)' : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </details>
              ))}
              {!overview.lessons.length && <p className="muted">No lessons imported yet.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
