import { FormEvent, useEffect, useRef, useState } from 'react';

type MeetingResponse = {
  roomName: string;
  meetingId: string;
  token: string;
  jitsiDomain: string;
};

type DashboardSummary = {
  meetings: Array<{
    id: string;
    room_key: string;
    title: string;
    scheduled_start: string;
    status: string;
  }>;
  attendance: Array<{ id: string; meeting_id: string; presence_seconds: number }>;
  telemetry: Array<{ id: number; meeting_id: string; event_type: string }>;
  source: string;
};

type JitsiApi = {
  dispose: () => void;
  addListener: (eventName: string, callback: (data?: unknown) => void) => void;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
const jitsiDomain = import.meta.env.VITE_JITSI_DOMAIN ?? 'meet.jit.si';

export default function App() {
  const [roomName, setRoomName] = useState('daraja-demo-room');
  const [userName, setUserName] = useState('Jane Doe');
  const [email, setEmail] = useState('jane.doe@daraja.local');
  const [status, setStatus] = useState('Ready to launch a secure room');
  const [isJoining, setIsJoining] = useState(false);
  const [meeting, setMeeting] = useState<MeetingResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [view, setView] = useState<'room' | 'dashboard'>('room');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const jitsiApiRef = useRef<JitsiApi | null>(null);
  const userIdRef = useRef<string | null>(null);
  const meetingIdRef = useRef<string | null>(null);
  const joinedAtRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, []);

  const startJitsi = async (room: string, token: string) => {
    if (!containerRef.current) {
      return;
    }

    const scriptId = 'jitsi-external-api';
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://${jitsiDomain}/external_api.js`;
      script.async = true;
      document.body.appendChild(script);
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Unable to load Jitsi script'));
      });
    }

    const JitsiMeetExternalAPI = (window as typeof window & { JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApi }).JitsiMeetExternalAPI;

    if (!JitsiMeetExternalAPI) {
      throw new Error('Jitsi external API not available');
    }

    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }

    const api = new JitsiMeetExternalAPI(jitsiDomain, {
      roomName: room,
      parentNode: containerRef.current,
      width: '100%',
      height: '100%',
      jwt: token,
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: false,
        prejoinPageEnabled: false,
        enableWelcomePage: false,
        disableThirdPartyRequests: true,
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: ['microphone', 'camera', 'desktop', 'chat', 'raisehand', 'tileview', 'hangup'],
        SHOW_JITSI_WATERMARK: false,
      },
    });

    const sendTelemetry = (eventType: string) => {
      if (!meetingIdRef.current || !userIdRef.current) return;
      void fetch(`${apiBaseUrl}/api/v1/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          meetingId: meetingIdRef.current,
          userId: userIdRef.current,
          timestamp: Date.now(),
        }),
        keepalive: true,
      });
    };

    api.addListener('videoConferenceJoined', () => {
      joinedAtRef.current = Date.now();
      sendTelemetry('CONFERENCE_JOINED');
      void fetch(`${apiBaseUrl}/api/v1/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId: meetingIdRef.current,
          userId: userIdRef.current,
          joinedAt: new Date().toISOString(),
        }),
      });
    });

    api.addListener('audioMuteStatusChanged', (data) => {
      sendTelemetry((data as { muted?: boolean })?.muted ? 'AUDIO_MUTED' : 'AUDIO_UNMUTED');
    });

    api.addListener('contentSharingParticipantsChanged', (data) => {
      const participants = (data as { data?: Array<{ isLocal?: boolean }> })?.data ?? [];
      sendTelemetry(participants.some((participant) => participant.isLocal) ? 'SCREEN_SHARE_STARTED' : 'SCREEN_SHARE_STOPPED');
    });

    api.addListener('readyToClose', () => {
      sendTelemetry('CONFERENCE_LEFT');
      const joinedAt = joinedAtRef.current;
      if (joinedAt && meetingIdRef.current && userIdRef.current) {
        void fetch(`${apiBaseUrl}/api/v1/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetingId: meetingIdRef.current,
            userId: userIdRef.current,
            joinedAt: new Date(joinedAt).toISOString(),
            leftAt: new Date().toISOString(),
            presenceSeconds: Math.max(0, Math.round((Date.now() - joinedAt) / 1000)),
          }),
          keepalive: true,
        });
      }
      setStatus('Room closed');
    });

    jitsiApiRef.current = api;
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsJoining(true);
    setStatus('Requesting a secure room token…');

    try {
      const userId = crypto.randomUUID();
      const response = await fetch(`${apiBaseUrl}/api/v1/rooms/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          userId,
          userName,
          email,
          title: `${roomName} session`,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to generate meeting token');
      }

      const payload: MeetingResponse = await response.json();
      userIdRef.current = userId;
      meetingIdRef.current = payload.meetingId;
      setMeeting(payload);
      setStatus(`Launching room ${payload.roomName}`);
      await startJitsi(payload.roomName, payload.token);
      setStatus(`Connected to ${payload.roomName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      setStatus(message);
    } finally {
      setIsJoining(false);
    }
  }

  async function loadDashboard() {
    setView('dashboard');
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/dashboard/summary`);
      if (!response.ok) throw new Error('Dashboard data unavailable');
      setDashboard(await response.json());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Dashboard data unavailable');
    }
  }

  const attendanceSeconds = dashboard?.attendance.reduce((total, item) => total + item.presence_seconds, 0) ?? 0;
  const liveRooms = dashboard?.meetings.filter((item) => item.status === 'live').length ?? 0;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand-wrap">
          <div className="brand-badge">D</div>
          <div>
            <p className="eyebrow">Enterprise video platform</p>
            <h1>Daraja Netizens</h1>
          </div>
        </div>

        <nav className="view-nav" aria-label="Workspace views">
          <button className={view === 'room' ? 'nav-button active' : 'nav-button'} onClick={() => setView('room')} type="button">Room launch</button>
          <button className={view === 'dashboard' ? 'nav-button active' : 'nav-button'} onClick={loadDashboard} type="button">Host dashboard</button>
        </nav>

        <div className="stats-grid">
          <div className="stat-card">
            <span>Live rooms</span>
            <strong>24</strong>
          </div>
          <div className="stat-card accent">
            <span>Attendance</span>
            <strong>96%</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="meeting-form">
          <label>
            Room name
            <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
          </label>

          <label>
            Display name
            <input value={userName} onChange={(event) => setUserName(event.target.value)} />
          </label>

          <label>
            Email address
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>

          <button type="submit" disabled={isJoining}>
            {isJoining ? 'Launching…' : 'Launch room'}
          </button>
        </form>

        <div className="status-box">
          <span className="status-label">Status</span>
          <strong>{status}</strong>
        </div>
      </aside>

      <section className="viewer-panel">
        {view === 'dashboard' ? (
          <div className="dashboard">
            <div className="viewer-header">
              <div>
                <p className="viewer-kicker">Operations overview</p>
                <h2>Host dashboard</h2>
              </div>
              <button className="refresh-button" type="button" onClick={loadDashboard}>Refresh</button>
            </div>
            <div className="dashboard-metrics">
              <div><span>Scheduled rooms</span><strong>{dashboard?.meetings.length ?? 0}</strong></div>
              <div><span>Live rooms</span><strong>{liveRooms}</strong></div>
              <div><span>Attendance events</span><strong>{dashboard?.attendance.length ?? 0}</strong></div>
              <div><span>Presence minutes</span><strong>{Math.round(attendanceSeconds / 60)}</strong></div>
            </div>
            <div className="dashboard-table">
              <div className="table-heading"><span>Room</span><span>Status</span><span>Scheduled</span></div>
              {dashboard?.meetings.length ? dashboard.meetings.map((item) => (
                <div className="table-row" key={item.id}>
                  <strong>{item.title}</strong>
                  <span className={`status-pill ${item.status}`}>{item.status}</span>
                  <span>{new Date(item.scheduled_start).toLocaleString()}</span>
                </div>
              )) : <div className="empty-state">No meetings have been created yet.</div>}
            </div>
          </div>
        ) : (
          <>
        <div className="viewer-header">
          <div>
            <p className="viewer-kicker">Meeting control</p>
            <h2>{meeting ? meeting.roomName : 'Meeting preview'}</h2>
          </div>
          <div className="viewer-meta">
            <span className="dot" />
            {meeting ? `Jitsi: ${meeting.jitsiDomain}` : 'Awaiting room launch'}
          </div>
        </div>
        <div className="viewer-host" ref={containerRef} />
          </>
        )}
      </section>
    </main>
  );
}
