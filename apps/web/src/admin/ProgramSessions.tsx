import { useEffect, useState, type FormEvent } from 'react';

import { apiFetch } from '../api';
import { formatDateTime } from '../staff/format';

type ProgramSession = {
  id: string;
  title: string;
  session_type: string;
  scheduled_at: string;
  status: string;
  required_for_training: boolean;
  required_for_stipend: boolean;
  week_key: string | null;
  is_makeup: boolean;
  attendees: number;
};

type ProgramData = {
  sessions: ProgramSession[];
  totals: { sessions: number; physical: number; online: number; completed: number; requiredForTraining: number; requiredForStipend: number };
};

const statuses = ['scheduled', 'completed', 'cancelled'] as const;

/** Admin-only: the programme schedule that eligibility is measured against. */
export default function ProgramSessions({ accessToken }: { accessToken: string | null }) {
  const [data, setData] = useState<ProgramData | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');

  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<'physical' | 'online'>('physical');
  const [scheduledAt, setScheduledAt] = useState('');
  const [weekKey, setWeekKey] = useState('');
  const [requiredForTraining, setRequiredForTraining] = useState(true);
  const [requiredForStipend, setRequiredForStipend] = useState(false);
  const [isMakeup, setIsMakeup] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const program = await apiFetch('/api/v1/admin/program', accessToken);
      setData(program);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Programme data is unavailable');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!scheduledAt) {
      setMessage('Choose the session date and time.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await apiFetch('/api/v1/admin/sessions', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          title,
          sessionType,
          scheduledAt: new Date(scheduledAt).toISOString(),
          requiredForTraining,
          requiredForStipend,
          weekKey: weekKey || undefined,
          isMakeup,
        }),
      });
      setTitle('');
      setScheduledAt('');
      setWeekKey('');
      setIsMakeup(false);
      setRequiredForStipend(false);
      setRequiredForTraining(true);
      setMessage('Session scheduled.');
      await load();
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : 'That session could not be scheduled');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    setMessage('');
    try {
      await apiFetch(`/api/v1/admin/sessions/${id}`, accessToken, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : 'That session could not be updated');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="panel-grid">
      <div className="metric-grid">
        <div className="metric-card"><span>Sessions</span><strong>{data?.totals.sessions ?? '—'}</strong></div>
        <div className="metric-card"><span>Physical</span><strong>{data?.totals.physical ?? '—'}</strong></div>
        <div className="metric-card"><span>Online</span><strong>{data?.totals.online ?? '—'}</strong></div>
        <div className="metric-card"><span>Completed</span><strong>{data?.totals.completed ?? '—'}</strong></div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p className="muted">{message}</p>}

      <div className="feature-card">
        <div className="panel-head">
          <div>
            <p className="viewer-kicker">Schedule a session</p>
            <h3>Add to the programme</h3>
          </div>
          <span className="panel-note">
            {data?.totals.requiredForTraining ?? 0} count towards training · {data?.totals.requiredForStipend ?? 0} towards stipend
          </span>
        </div>
        <form onSubmit={create}>
          <div className="form-grid">
            <label className="full">
              Session title
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Week 5 · Boundaries and consent" required />
            </label>
            <label>
              Type
              <select value={sessionType} onChange={(event) => setSessionType(event.target.value as 'physical' | 'online')}>
                <option value="physical">Physical</option>
                <option value="online">Online</option>
              </select>
            </label>
            <label>
              Starts
              <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required />
            </label>
            <label>
              Week key (optional)
              <input value={weekKey} onChange={(event) => setWeekKey(event.target.value)} placeholder="week-5" />
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={requiredForTraining} onChange={(event) => setRequiredForTraining(event.target.checked)} />
              Counts towards training eligibility
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={requiredForStipend} onChange={(event) => setRequiredForStipend(event.target.checked)} />
              Counts towards stipend eligibility
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={isMakeup} onChange={(event) => setIsMakeup(event.target.checked)} />
              Make-up session
            </label>
          </div>
          <p className="muted small">Times are stored in UTC.</p>
          <button type="submit" disabled={saving}>{saving ? 'Scheduling…' : 'Schedule session'}</button>
        </form>
      </div>

      <div className="feature-card">
        <div className="panel-head">
          <div>
            <p className="viewer-kicker">Programme plan</p>
            <h3>{data?.sessions.length ?? 0} sessions</h3>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">When</th>
                <th scope="col">Type</th>
                <th scope="col">Counts</th>
                <th scope="col">Attendees</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.sessions ?? []).map((session) => (
                <tr key={session.id}>
                  <td>
                    <div className="cell-stack">
                      <strong>{session.title}</strong>
                      <span>{session.week_key ?? '—'}{session.is_makeup ? ' · make-up' : ''}</span>
                    </div>
                  </td>
                  <td>{formatDateTime(session.scheduled_at)}</td>
                  <td>{session.session_type}</td>
                  <td>
                    <div className="tag-row">
                      {session.required_for_training && <span className="tag ok">Training</span>}
                      {session.required_for_stipend && <span className="tag">Stipend</span>}
                    </div>
                  </td>
                  <td className="num">{session.attendees}</td>
                  <td>
                    <select
                      value={statuses.includes(session.status as (typeof statuses)[number]) ? session.status : 'scheduled'}
                      aria-label={`Status for ${session.title}`}
                      disabled={busyId === session.id}
                      onChange={(event) => void updateStatus(session.id, event.target.value)}
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {data && !data.sessions.length && (
                <tr><td colSpan={6} className="muted">No sessions scheduled yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
