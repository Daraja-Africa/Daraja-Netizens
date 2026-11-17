import { useEffect, useState } from 'react';

import { apiFetch } from '../api';
import { formatDateTime, formatTime } from '../staff/format';

export type FacilitatorSession = {
  id: string;
  title: string;
  session_type: string;
  scheduled_at: string;
  status: string;
  required_for_training: boolean;
  attendees: number;
};

type FacilitatorMeeting = { id: string; room_key: string; title: string; scheduled_start: string | null; status: string | null };

type FacilitatorCheckIn = {
  id: string;
  sessionTitle: string;
  created_at: string;
  expires_at: string;
  redeemed_at: string | null;
};

export type FacilitatorOverviewData = {
  stats: {
    sessions: number;
    completedSessions: number;
    upcomingSessions: number;
    attendanceRecords: number;
    hostedMeetings: number;
    checkInsIssued: number;
    checkInsRedeemed: number;
  };
  sessions: FacilitatorSession[];
  recentMeetings: FacilitatorMeeting[];
  recentCheckIns: FacilitatorCheckIn[];
};

/** Loads the facilitator's own numbers; the hook is shared with the meetings screen. */
export function useFacilitatorOverview(accessToken: string | null) {
  const [data, setData] = useState<FacilitatorOverviewData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiFetch('/api/v1/facilitator/overview', accessToken)
      .then((overview: FacilitatorOverviewData) => {
        if (active) {
          setData(overview);
          setError('');
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Your facilitator overview is unavailable');
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  return { data, error };
}

/** The facilitator's landing screen: the sessions they run and the check-ins they issued. */
export default function FacilitatorOverview({ accessToken, name }: { accessToken: string | null; name?: string }) {
  const { data, error } = useFacilitatorOverview(accessToken);
  const upcoming = (data?.sessions ?? []).filter((session) => session.status === 'scheduled').slice(0, 4);

  return (
    <section className="overview">
      <div className="hero-card">
        <div>
          <p className="viewer-kicker">Your sessions</p>
          <h3>Run the session, record the room.</h3>
          <p className="muted">
            {name ? `Welcome back, ${name}. ` : ''}
            Check-in codes, attendance and the training room for the sessions you facilitate live here. Programme-wide
            figures stay with the administrators.
          </p>
        </div>
        <span className="hero-orb">◈</span>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="metric-grid">
        <div className="metric-card"><span>Upcoming sessions</span><strong>{data?.stats.upcomingSessions ?? '—'}</strong></div>
        <div className="metric-card"><span>Completed</span><strong>{data?.stats.completedSessions ?? '—'}</strong></div>
        <div className="metric-card"><span>Check-ins redeemed</span><strong>{data?.stats.checkInsRedeemed ?? '—'}</strong></div>
        <div className="metric-card"><span>Attendance recorded</span><strong>{data?.stats.attendanceRecords ?? '—'}</strong></div>
      </div>

      <div className="panel-split">
        <div className="feature-card">
          <div className="panel-head">
            <div>
              <p className="viewer-kicker">Next up</p>
              <h3>Your sessions</h3>
            </div>
          </div>
          <ul className="list-plain">
            {upcoming.map((session) => (
              <li key={session.id}>
                <strong>{session.title}</strong>
                <span className="muted">{formatDateTime(session.scheduled_at)} · {session.session_type} · {session.attendees} present</span>
              </li>
            ))}
            {data && !upcoming.length && <li className="muted">No upcoming sessions assigned yet.</li>}
          </ul>
        </div>

        <div className="feature-card">
          <div className="panel-head">
            <div>
              <p className="viewer-kicker">Check-in codes</p>
              <h3>Recently issued</h3>
            </div>
            <span className="panel-note">{data?.stats.checkInsIssued ?? 0} issued in total</span>
          </div>
          <ul className="list-plain">
            {(data?.recentCheckIns ?? []).map((checkIn) => (
              <li key={checkIn.id}>
                <strong>{checkIn.sessionTitle}</strong>
                <span className="muted">
                  {checkIn.redeemed_at ? `Redeemed at ${formatTime(checkIn.redeemed_at)}` : `Expired ${formatTime(checkIn.expires_at)} unused`}
                </span>
              </li>
            ))}
            {data && !data.recentCheckIns.length && <li className="muted">No check-in codes issued yet.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
