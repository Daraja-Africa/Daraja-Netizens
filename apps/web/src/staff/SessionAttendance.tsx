import { useEffect, useState } from 'react';

import { apiFetch } from '../api';
import { formatDateTime } from './format';

type SessionSummary = {
  id: string;
  title: string;
  session_type: string;
  scheduled_at: string;
  status: string;
};

type AttendanceMember = {
  id: string;
  full_name: string;
  email: string;
  cohort: string | null;
  present: boolean;
  source: string | null;
  locked: boolean;
};

type SessionAttendanceData = {
  session: { id: string; title: string; session_type: string; scheduled_at: string; status: string };
  members: AttendanceMember[];
  present: number;
  total: number;
};

/**
 * Records who attended a programme session. Both staff roles use it: an admin
 * keeps historical records right, a facilitator marks the session they ran.
 * Imported and QR-based records are shown as locked instead of being cleared.
 */
export default function SessionAttendance({ accessToken }: { accessToken: string | null }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [sheet, setSheet] = useState<SessionAttendanceData | null>(null);
  const [message, setMessage] = useState('');
  const [busyMember, setBusyMember] = useState('');

  useEffect(() => {
    void apiFetch('/api/v1/sessions', accessToken)
      .then((data: { sessions: SessionSummary[] }) => {
        setSessions(data.sessions);
        setSessionId((current) => current || data.sessions[0]?.id || '');
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Sessions are unavailable'));
  }, [accessToken]);

  useEffect(() => {
    if (!sessionId) {
      setSheet(null);
      return;
    }
    let active = true;
    void apiFetch(`/api/v1/sessions/${sessionId}/attendance`, accessToken)
      .then((data: SessionAttendanceData) => {
        if (active) {
          setSheet(data);
          setMessage('');
        }
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : 'Session attendance is unavailable');
      });
    return () => {
      active = false;
    };
  }, [accessToken, sessionId]);

  async function toggle(member: AttendanceMember) {
    if (!sheet) return;
    setBusyMember(member.id);
    setMessage('');
    try {
      await apiFetch(`/api/v1/sessions/${sheet.session.id}/attendance`, accessToken, {
        method: 'PUT',
        body: JSON.stringify({ memberId: member.id, present: !member.present }),
      });
      setSheet({
        ...sheet,
        members: sheet.members.map((row) => (row.id === member.id ? { ...row, present: !row.present, locked: false } : row)),
        present: sheet.present + (member.present ? -1 : 1),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Attendance could not be saved');
    } finally {
      setBusyMember('');
    }
  }

  return (
    <section className="panel-grid">
      <div className="feature-card">
        <div className="panel-head">
          <div>
            <p className="viewer-kicker">Session records</p>
            <h3>Record attendance</h3>
          </div>
          {sheet && <span className="panel-note">{sheet.present} of {sheet.total} marked present</span>}
        </div>
        <div className="session-picker">
          <label>
            Training session
            <select value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
              <option value="">Choose a session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} · {formatDateTime(session.scheduled_at)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {message && <p className="error-text">{message}</p>}
        {!sessions.length && !message && <p className="muted">No programme sessions have been scheduled yet.</p>}
      </div>

      {sheet && (
        <div className="feature-card">
          <div className="panel-head">
            <div>
              <p className="viewer-kicker">{sheet.session.session_type} session</p>
              <h3>{sheet.session.title}</h3>
            </div>
            <span className="tag">{sheet.session.status}</span>
          </div>
          <div className="attendance-list">
            {sheet.members.map((member) => (
              <div key={member.id} className="attendance-row">
                <div className="who">
                  <strong>{member.full_name}</strong>
                  <span>{member.cohort ? `${member.cohort} · ${member.email}` : member.email}</span>
                </div>
                <button
                  type="button"
                  className={member.present ? 'is-present' : member.locked ? 'is-locked' : ''}
                  disabled={busyMember === member.id || member.locked}
                  title={member.locked ? `Recorded from ${member.source ?? 'an import'} and cannot be cleared here` : undefined}
                  onClick={() => void toggle(member)}
                >
                  {member.present ? (member.locked ? `Present · ${member.source ?? 'imported'}` : 'Present') : 'Mark present'}
                </button>
              </div>
            ))}
            {!sheet.members.length && <p className="muted">No roster members yet.</p>}
          </div>
          <p className="muted small">
            Imported and QR check-in records are locked here so historical attendance is never lost.
          </p>
        </div>
      )}
    </section>
  );
}
