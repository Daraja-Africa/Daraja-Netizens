import { useCallback, useEffect, useMemo, useState } from 'react';

import { ApiError, apiFetch } from '../api';
import './reachOutInbox.css';

type Urgency = 'within-24-hours' | 'this-week' | 'general-check-in';
type Status = 'new' | 'in_progress' | 'closed';

type Note = {
  id: string;
  reference: string;
  name: string | null;
  contact_method: string;
  contact_detail: string;
  support_topic: string;
  urgency: Urgency;
  message: string;
  status: Status;
  assigned_to: string | null;
  first_response_at: string | null;
  closed_at: string | null;
  created_at: string;
};

type Summary = { total: number; new: number; inProgress: number; closed: number; overdue: number; urgent: number };
type Sla = { dueAt: string | null; hoursRemaining: number | null; overdue: boolean };

const urgencyLabels: Record<Urgency, string> = {
  'within-24-hours': 'Within 24 hours',
  'this-week': 'This week',
  'general-check-in': 'General check-in',
};

const statusLabels: Record<Status, string> = {
  new: 'New',
  in_progress: 'In progress',
  closed: 'Closed',
};

const methodLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  phone: 'Phone call',
  sms: 'SMS',
  email: 'Email',
};

function topicLabel(topic: string) {
  return topic.replace(/-/g, ' ');
}

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function dueLabel(sla: Sla) {
  if (!sla.dueAt) return 'Answered';
  if (sla.hoursRemaining === null) return 'No clock';
  if (sla.overdue) return `Overdue by ${Math.abs(sla.hoursRemaining)} h`;
  if (sla.hoursRemaining < 1) return 'Due within the hour';
  return `${sla.hoursRemaining} h left`;
}

export default function ReachOutInbox({ accessToken, currentUserId }: { accessToken: string | null; currentUserId?: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [openNote, setOpenNote] = useState<{ note: Note; sla: Sla } | null>(null);
  const [loadError, setLoadError] = useState('');
  const [migrationDetail, setMigrationDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const data = await apiFetch('/api/v1/facilitator/reach-out', accessToken);
      setNotes(Array.isArray(data?.notes) ? data.notes : []);
      setSummary(data?.summary ?? null);
      setMigrationDetail('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setMigrationDetail(typeof error.payload?.detail === 'string' ? error.payload.detail : '');
        return;
      }
      setLoadError(error instanceof Error ? error.message : 'The reach-out inbox is unavailable');
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter === 'all' ? notes : notes.filter((note) => note.status === filter)),
    [filter, notes]
  );

  async function open(id: string) {
    setNotice('');
    try {
      const data = await apiFetch(`/api/v1/facilitator/reach-out/${id}`, accessToken);
      setOpenNote({ note: data.note, sla: data.sla });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This note could not be opened');
    }
  }

  async function update(note: Note, patch: { status?: Status; assignedTo?: string | null }) {
    setBusy(true);
    setNotice('');
    try {
      const data = await apiFetch(`/api/v1/facilitator/reach-out/${note.id}`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setOpenNote({ note: data.note, sla: data.sla });
      await load();
      setNotice(patch.status ? `Note moved to ${statusLabels[patch.status].toLowerCase()}.` : 'Note assigned to you.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That update did not save');
    } finally {
      setBusy(false);
    }
  }

  if (migrationDetail) {
    return (
      <section className="triage">
        <div className="triage-empty">
          <p className="viewer-kicker">Reach-out inbox</p>
          <h3>One database migration is missing.</h3>
          <p className="muted">
            Student notes are arriving and stored safely, but the triage screen needs the ownership and access-log
            columns before it can show them.
          </p>
          <code>{migrationDetail}</code>
        </div>
      </section>
    );
  }

  return (
    <section className="triage">
      <div className="metric-grid">
        <div className="metric-card"><span>New notes</span><strong>{summary?.new ?? '—'}</strong></div>
        <div className="metric-card"><span>In progress</span><strong>{summary?.inProgress ?? '—'}</strong></div>
        <div className="metric-card"><span>Overdue</span><strong>{summary?.overdue ?? '—'}</strong></div>
        <div className="metric-card"><span>Closed</span><strong>{summary?.closed ?? '—'}</strong></div>
      </div>

      <div className="triage-note">
        <p className="viewer-kicker">Confidential</p>
        <p className="muted small">
          Every note you open is recorded against your account. Read only what you need, and never copy a note into
          email, chat or a spreadsheet.
        </p>
      </div>

      {loadError && <p className="error-text" role="alert">{loadError}</p>}
      {notice && <p className="triage-notice" role="status">{notice}</p>}

      <div className="category-chips" role="group" aria-label="Filter notes by status">
        {(['all', 'new', 'in_progress', 'closed'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={filter === key ? 'chip active' : 'chip'}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {key === 'all' ? 'All notes' : statusLabels[key]}
          </button>
        ))}
        <button type="button" className="refresh-button" onClick={() => void load()}>Refresh</button>
      </div>

      <div className="triage-layout">
        <div className="triage-list">
          {visible.length === 0 ? (
            <div className="triage-empty">
              <strong>Nothing here right now.</strong>
              <span>
                {filter === 'all'
                  ? 'When a student reaches out, the note appears here and on the alert channel.'
                  : `No ${statusLabels[filter].toLowerCase()} notes.`}
              </span>
            </div>
          ) : (
            visible.map((note) => (
              <button
                key={note.id}
                type="button"
                className={openNote?.note.id === note.id ? 'triage-row active' : 'triage-row'}
                onClick={() => void open(note.id)}
              >
                <span className="triage-row-top">
                  <span className={`triage-urgency ${note.urgency}`}>{urgencyLabels[note.urgency]}</span>
                  <span className="triage-age">{timeAgo(note.created_at)}</span>
                </span>
                <strong>{note.name?.trim() ? note.name : 'Anonymous student'}</strong>
                <span className="triage-topic">{topicLabel(note.support_topic)}</span>
                <span className="triage-row-foot">
                  <span className={`triage-status ${note.status}`}>{statusLabels[note.status]}</span>
                  <span>{note.assigned_to ? 'Owned' : 'Unclaimed'}</span>
                  <code>{note.reference}</code>
                </span>
              </button>
            ))
          )}
        </div>

        <aside className="triage-detail">
          {openNote ? (
            <>
              <div className="triage-detail-head">
                <span className={`triage-urgency ${openNote.note.urgency}`}>{urgencyLabels[openNote.note.urgency]}</span>
                <span className={openNote.sla.overdue ? 'triage-due late' : 'triage-due'}>{dueLabel(openNote.sla)}</span>
              </div>
              <h3>{openNote.note.name?.trim() ? openNote.note.name : 'Anonymous student'}</h3>
              <p className="muted small">
                {topicLabel(openNote.note.support_topic)} · received {timeAgo(openNote.note.created_at)} ·{' '}
                <code>{openNote.note.reference}</code>
              </p>

              <div className="triage-contact">
                <span>{methodLabels[openNote.note.contact_method] ?? openNote.note.contact_method}</span>
                <strong>{openNote.note.contact_detail}</strong>
              </div>

              <p className="triage-message">{openNote.note.message}</p>

              <div className="triage-actions">
                {openNote.note.assigned_to !== currentUserId && (
                  <button type="button" disabled={busy} onClick={() => void update(openNote.note, { assignedTo: currentUserId ?? null })}>
                    Claim this note
                  </button>
                )}
                {openNote.note.status !== 'in_progress' && openNote.note.status !== 'closed' && (
                  <button type="button" className="ghost-button" disabled={busy} onClick={() => void update(openNote.note, { status: 'in_progress' })}>
                    Mark in progress
                  </button>
                )}
                {openNote.note.status !== 'closed' ? (
                  <button type="button" className="ghost-button" disabled={busy} onClick={() => void update(openNote.note, { status: 'closed' })}>
                    Close note
                  </button>
                ) : (
                  <button type="button" className="ghost-button" disabled={busy} onClick={() => void update(openNote.note, { status: 'in_progress' })}>
                    Reopen note
                  </button>
                )}
                <button type="button" className="ghost-button" onClick={() => setOpenNote(null)}>Close panel</button>
              </div>

              <p className="muted small">
                {openNote.note.first_response_at
                  ? `First response sent ${timeAgo(openNote.note.first_response_at)}.`
                  : 'No response has been sent yet — the clock is still running.'}
              </p>
            </>
          ) : (
            <div className="triage-empty">
              <strong>Select a note.</strong>
              <span>Urgent, unanswered notes are listed first. Opening one is logged.</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
