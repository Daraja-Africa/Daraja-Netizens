import { formatDateTime, formatDate } from '../staff/format';
import SessionAttendance from '../staff/SessionAttendance';
import { useFacilitatorOverview } from './FacilitatorOverview';

/** The facilitator's session list plus the attendance sheet they fill in while a session runs. */
export default function Meetings({ accessToken }: { accessToken: string | null }) {
  const { data, error } = useFacilitatorOverview(accessToken);

  return (
    <section className="panel-grid">
      {error && <p className="error-text">{error}</p>}

      <div className="panel-split">
        <div className="feature-card">
          <div className="panel-head">
            <div>
              <p className="viewer-kicker">Programme sessions</p>
              <h3>{data?.sessions.length ?? 0} sessions</h3>
            </div>
          </div>
          <ul className="list-plain">
            {(data?.sessions ?? []).slice(0, 8).map((session) => (
              <li key={session.id}>
                <strong>{session.title}</strong>
                <span className="muted">
                  {formatDateTime(session.scheduled_at)} · {session.session_type} · {session.status} · {session.attendees} present
                </span>
              </li>
            ))}
            {data && !data.sessions.length && <li className="muted">No sessions scheduled yet.</li>}
          </ul>
        </div>

        <div className="feature-card">
          <div className="panel-head">
            <div>
              <p className="viewer-kicker">Training rooms</p>
              <h3>Rooms you opened</h3>
            </div>
            <span className="panel-note">{data?.stats.hostedMeetings ?? 0} hosted</span>
          </div>
          <ul className="list-plain">
            {(data?.recentMeetings ?? []).map((meeting) => (
              <li key={meeting.id}>
                <strong>{meeting.title}</strong>
                <span className="muted">{formatDate(meeting.scheduled_start)} · {meeting.room_key} · {meeting.status ?? 'open'}</span>
              </li>
            ))}
            {data && !data.recentMeetings.length && <li className="muted">You have not opened a training room yet.</li>}
          </ul>
        </div>
      </div>

      <SessionAttendance accessToken={accessToken} />
    </section>
  );
}
