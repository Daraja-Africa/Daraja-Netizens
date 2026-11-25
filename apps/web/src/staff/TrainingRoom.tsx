import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { apiFetch, requestRoomToken, type RoomTokenResponse } from '../api';
import JitsiConference from './JitsiConference';

type TrainingSession = { id: string; title: string; session_type: string; scheduled_at: string; status: string };
type TelemetryEvent = { id: string; event_type: string; created_at: string; meeting_id: string };

/** Staff room launcher: sessions keep Jitsi attendance tied to programme eligibility. */
export default function TrainingRoom({ accessToken, userId, defaultName, email }: { accessToken: string | null; userId: string; defaultName?: string; email?: string }) {
  const [roomName, setRoomName] = useState('daraja-training-room');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([]);
  const [status, setStatus] = useState('Choose a scheduled session or create a custom room.');
  const [busy, setBusy] = useState(false);
  const [meeting, setMeeting] = useState<RoomTokenResponse | null>(null);

  const refreshTelemetry = useCallback(() => {
    if (!accessToken) return;
    void (apiFetch('/api/v1/telemetry?limit=6', accessToken) as Promise<{ events: TelemetryEvent[] }>)
      .then((data) => setTelemetry(data.events))
      .catch(() => undefined);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let current = true;
    void Promise.all([
      apiFetch('/api/v1/sessions', accessToken) as Promise<{ sessions: TrainingSession[] }>,
      apiFetch('/api/v1/telemetry?limit=6', accessToken) as Promise<{ events: TelemetryEvent[] }>,
    ]).then(([sessionData, telemetryData]) => {
      if (!current) return;
      setSessions(sessionData.sessions.filter((session) => session.status !== 'cancelled'));
      setTelemetry(telemetryData.events);
    }).catch((error: unknown) => {
      if (current) setStatus(error instanceof Error ? error.message : 'Room schedule is unavailable. You can still enter a custom room.');
    });
    return () => { current = false; };
  }, [accessToken]);

  function selectScheduledSession(id: string) {
    setSelectedSessionId(id);
    const session = sessions.find((item) => item.id === id);
    if (session) setRoomName(session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70) || 'daraja-training-room');
  }

  async function launch(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) {
      setStatus('Sign in to launch a verified training room.');
      return;
    }
    setBusy(true);
    try {
      const data = await requestRoomToken(accessToken, {
        roomName: roomName.trim(),
        title: selectedSessionId ? sessions.find((item) => item.id === selectedSessionId)?.title : `${roomName} training`,
        sessionId: selectedSessionId || undefined,
      });
      setMeeting(data);
      setStatus(`Room ready: ${data.roomName}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to prepare this training room.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="training-room-stack">
      <div className="training-layout">
        <form className="feature-card" onSubmit={launch}>
          <p className="viewer-kicker">Virtual training room</p>
          <h3>Start a verified live session</h3>
          <label>Scheduled session (optional)
            <select value={selectedSessionId} onChange={(event) => selectScheduledSession(event.target.value)}>
              <option value="">Custom room</option>
              {sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {new Date(session.scheduled_at).toLocaleDateString()}</option>)}
            </select>
          </label>
          <label>Room name<input value={roomName} minLength={3} maxLength={80} onChange={(event) => setRoomName(event.target.value)} required /></label>
          <p className="muted">A scheduled session links Jitsi presence to its eligibility record. Custom rooms remain available for planning and support calls.</p>
          <button type="submit" disabled={busy}>{busy ? 'Preparing…' : 'Prepare training room'}</button>
          <p className="muted" role="status">{status}</p>
        </form>

        <div className="feature-card room-ledger">
          <p className="viewer-kicker">Room activity</p>
          <h3>Recent attendance telemetry</h3>
          <ul className="list-plain">
            {telemetry.map((event) => <li key={event.id}><strong>{event.event_type.replace(/_/g, ' ')}</strong><span className="muted">{new Date(event.created_at).toLocaleString()} · {event.meeting_id}</span></li>)}
            {!telemetry.length && <li className="muted">Recent room joins and attendance events will appear here.</li>}
          </ul>
        </div>
      </div>
      {meeting && accessToken && (
        <JitsiConference
          accessToken={accessToken}
          roomName={meeting.roomName}
          roomTitle={selectedSessionId ? sessions.find((session) => session.id === selectedSessionId)?.title : meeting.roomName}
          meetingId={meeting.meetingId}
          sessionId={meeting.sessionId}
          token={meeting.token}
          requiresJitsiJwt={meeting.requiresJitsiJwt}
          user={{ id: meeting.user?.id ?? userId, name: meeting.user?.name ?? defaultName ?? 'Facilitator', email: meeting.user?.email ?? email ?? 'facilitator@daraja.local' }}
          isModerator={meeting.user?.isModerator}
          jitsiDomain={meeting.jitsiDomain}
          onTelemetrySent={refreshTelemetry}
        />
      )}
    </section>
  );
}
