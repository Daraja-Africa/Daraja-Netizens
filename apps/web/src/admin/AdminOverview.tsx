import { useEffect, useState } from 'react';

import { apiFetch } from '../api';
import { formatDateTime } from '../staff/format';

type AdminOverviewData = {
  totals: {
    members: number;
    facilitators: number;
    admins: number;
    sessions: number;
    upcomingSessions: number;
    attendanceRecords: number;
    trainingEligible: number;
    stipendEligible: number;
    averageAttendanceRate: number;
  };
  cohorts: Array<{ cohort: string; members: number; trainingEligible: number; attendanceRate: number }>;
  upcoming: Array<{ id: string; title: string; session_type: string; scheduled_at: string; status: string }>;
  recentSessions: Array<{ id: string; title: string; session_type: string; scheduled_at: string; status: string; attendees: number }>;
};

export default function AdminOverview({ accessToken }: { accessToken: string | null }) {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiFetch('/api/v1/admin/overview', accessToken)
      .then((overview: AdminOverviewData) => {
        if (active) {
          setData(overview);
          setError('');
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'The admin overview is unavailable');
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const totals = data?.totals;

  return (
    <section className="overview">
      <div className="hero-card">
        <div>
          <p className="viewer-kicker">Programme health</p>
          <h3>Every cohort, every session, one admin view.</h3>
          <p className="muted">
            Membership, staff access and eligibility across the programme. Facilitators have their own dashboard and do
            not see these figures.
          </p>
        </div>
        <span className="hero-orb">✦</span>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="metric-grid">
        <div className="metric-card"><span>Members</span><strong>{totals?.members ?? '—'}</strong></div>
        <div className="metric-card"><span>Facilitators</span><strong>{totals?.facilitators ?? '—'}</strong></div>
        <div className="metric-card"><span>Upcoming sessions</span><strong>{totals?.upcomingSessions ?? '—'}</strong></div>
        <div className="metric-card"><span>Average attendance</span><strong>{totals ? `${totals.averageAttendanceRate}%` : '—'}</strong></div>
      </div>

      <div className="metric-grid">
        <div className="metric-card"><span>Training eligible</span><strong>{totals?.trainingEligible ?? '—'}</strong></div>
        <div className="metric-card"><span>Stipend eligible</span><strong>{totals?.stipendEligible ?? '—'}</strong></div>
        <div className="metric-card"><span>Sessions</span><strong>{totals?.sessions ?? '—'}</strong></div>
        <div className="metric-card"><span>Attendance records</span><strong>{totals?.attendanceRecords ?? '—'}</strong></div>
      </div>

      <div className="panel-split">
        <div className="feature-card">
          <div className="panel-head">
            <div>
              <p className="viewer-kicker">Next up</p>
              <h3>Upcoming sessions</h3>
            </div>
          </div>
          <ul className="list-plain">
            {(data?.upcoming ?? []).map((session) => (
              <li key={session.id}>
                <strong>{session.title}</strong>
                <span className="muted">{formatDateTime(session.scheduled_at)} · {session.session_type}</span>
              </li>
            ))}
            {data && !data.upcoming.length && <li className="muted">Nothing scheduled ahead yet.</li>}
          </ul>
        </div>

        <div className="feature-card">
          <div className="panel-head">
            <div>
              <p className="viewer-kicker">Cohorts</p>
              <h3>Attendance by cohort</h3>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Cohort</th>
                  <th scope="col">Members</th>
                  <th scope="col">Training eligible</th>
                  <th scope="col">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {(data?.cohorts ?? []).map((cohort) => (
                  <tr key={cohort.cohort}>
                    <td>{cohort.cohort}</td>
                    <td className="num">{cohort.members}</td>
                    <td className="num">{cohort.trainingEligible}</td>
                    <td className="num">{cohort.attendanceRate}%</td>
                  </tr>
                ))}
                {data && !data.cohorts.length && (
                  <tr><td colSpan={4} className="muted">No cohorts recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="feature-card">
        <div className="panel-head">
          <div>
            <p className="viewer-kicker">Latest</p>
            <h3>Recent sessions</h3>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">When</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Attendees</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentSessions ?? []).map((session) => (
                <tr key={session.id}>
                  <td>{session.title}</td>
                  <td>{formatDateTime(session.scheduled_at)}</td>
                  <td>{session.session_type}</td>
                  <td>{session.status}</td>
                  <td className="num">{session.attendees}</td>
                </tr>
              ))}
              {data && !data.recentSessions.length && (
                <tr><td colSpan={5} className="muted">No sessions recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
