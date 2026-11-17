import { useEffect, useState } from 'react';

import { apiFetch } from '../api';
import { formatDate, formatDateTime } from '../staff/format';
import { roleLabel, type AppRole } from '../roles';

type StaffAccount = {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  phone: string | null;
  hostedMeetings: number;
  lastHostedAt: string | null;
  checkInsIssued: number;
  checkInsRedeemed: number;
};

type Candidate = { id: string; full_name: string; email: string; cohort: string | null };

type FacilitatorDirectoryData = { facilitators: StaffAccount[]; candidates: Candidate[] };

const assignableRoles: AppRole[] = ['facilitator', 'admin', 'student', 'participant'];

/** Admin-only: who can sign in to a staff dashboard, and what they may open. */
export default function FacilitatorDirectory({ accessToken }: { accessToken: string | null }) {
  const [data, setData] = useState<FacilitatorDirectoryData | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [candidateRole, setCandidateRole] = useState<AppRole>('facilitator');

  async function load() {
    try {
      const directory = await apiFetch('/api/v1/admin/facilitators', accessToken);
      setData(directory);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The facilitator directory is unavailable');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function changeRole(id: string, role: AppRole) {
    setBusyId(id);
    setMessage('');
    try {
      await apiFetch(`/api/v1/admin/users/${id}/role`, accessToken, { method: 'PATCH', body: JSON.stringify({ role }) });
      setMessage(`Access updated to ${roleLabel(role)}.`);
      await load();
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : 'That role change was refused');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="panel-grid">
      {error && <p className="error-text">{error}</p>}
      {message && <p className="muted">{message}</p>}

      <div className="feature-card">
        <div className="panel-head">
          <div>
            <p className="viewer-kicker">Staff access</p>
            <h3>{data?.facilitators.length ?? 0} staff accounts</h3>
          </div>
          <span className="panel-note">Admins see every dashboard · facilitators only their own</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Role</th>
                <th scope="col">Meetings hosted</th>
                <th scope="col">Check-ins</th>
                <th scope="col">Last hosted</th>
              </tr>
            </thead>
            <tbody>
              {(data?.facilitators ?? []).map((account) => (
                <tr key={account.id}>
                  <td>
                    <div className="cell-stack">
                      <strong>{account.full_name}</strong>
                      <span>{account.email}</span>
                    </div>
                  </td>
                  <td>
                    <select
                      value={account.role}
                      aria-label={`Role for ${account.full_name}`}
                      disabled={busyId === account.id}
                      onChange={(event) => void changeRole(account.id, event.target.value as AppRole)}
                    >
                      {assignableRoles.map((role) => (
                        <option key={role} value={role}>{roleLabel(role)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="num">{account.hostedMeetings}</td>
                  <td className="num">{account.checkInsRedeemed}/{account.checkInsIssued}</td>
                  <td>{formatDate(account.lastHostedAt)}</td>
                </tr>
              ))}
              {data && !data.facilitators.length && (
                <tr><td colSpan={5} className="muted">No staff accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="feature-card">
        <div className="panel-head">
          <div>
            <p className="viewer-kicker">Grant access</p>
            <h3>Make a roster member staff</h3>
          </div>
        </div>
        <p className="muted">
          Members are people in training. Promoting one to facilitator opens the facilitator dashboard for them;
          administrator access also opens this admin dashboard.
        </p>
        <div className="session-picker">
          <label>
            Roster member
            <select value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
              <option value="">Choose a member</option>
              {(data?.candidates ?? []).map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.full_name}{candidate.cohort ? ` · ${candidate.cohort}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            New role
            <select value={candidateRole} onChange={(event) => setCandidateRole(event.target.value as AppRole)}>
              <option value="facilitator">Facilitator</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!candidateId || busyId !== ''}
            onClick={() => {
              if (!candidateId) return;
              void changeRole(candidateId, candidateRole).then(() => setCandidateId(''));
            }}
          >
            Update access
          </button>
        </div>
      </div>

      <div className="feature-card">
        <p className="viewer-kicker">Access model</p>
        <h3>Who sees what</h3>
        <ul className="check-list">
          <li><strong>Administrator</strong> — admin dashboard, member directory, staff access, programme setup, all data imports, and the facilitator screens.</li>
          <li><strong>Facilitator</strong> — facilitator dashboard only: their sessions, attendance recording, QR check-in and the training room.</li>
          <li><strong>Member / student</strong> — the student portal only; staff routes redirect them away.</li>
        </ul>
      </div>
      <p className="muted small">Staff activity is timestamped in UTC. Latest refresh: {formatDateTime(new Date().toISOString())}.</p>
    </section>
  );
}
