import { useEffect, useRef, useState, type FormEvent } from 'react';

import { apiFetch } from '../api';

type JitsiApi = {
  dispose: () => void;
  addListener: (eventName: string, callback: (data?: unknown) => void) => void;
};

type Meeting = { roomName: string; meetingId: string; token: string; jitsiDomain: string };

const jitsiDomain = import.meta.env.VITE_JITSI_DOMAIN ?? 'meet.jit.si';

/** Launches the secure Jitsi training room and records join/leave attendance. */
export default function TrainingRoom({ accessToken, userId, defaultName }: { accessToken: string | null; userId: string; defaultName?: string }) {
  const [roomName, setRoomName] = useState('daraja-training-room');
  const [displayName, setDisplayName] = useState(defaultName ?? 'Facilitator');
  const [roomEmail, setRoomEmail] = useState('facilitator@daraja.local');
  const [status, setStatus] = useState('Launch a room to begin');
  const [busy, setBusy] = useState(false);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const jitsiApiRef = useRef<JitsiApi | null>(null);
  const joinedAtRef = useRef<number | null>(null);

  useEffect(() => () => {
    jitsiApiRef.current?.dispose();
  }, []);

  async function startJitsi(room: string, token: string, meetingId: string, attendeeId: string) {
    if (!containerRef.current) return;
    const existing = document.getElementById('jitsi-external-api');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'jitsi-external-api';
      script.src = `https://${jitsiDomain}/external_api.js`;
      script.async = true;
      document.body.appendChild(script);
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Unable to load Jitsi'));
      });
    }
    const JitsiMeetExternalAPI = (window as typeof window & {
      JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApi;
    }).JitsiMeetExternalAPI;
    if (!JitsiMeetExternalAPI) throw new Error('Jitsi external API unavailable');
    jitsiApiRef.current?.dispose();
    const api = new JitsiMeetExternalAPI(jitsiDomain, {
      roomName: room,
      parentNode: containerRef.current,
      width: '100%',
      height: '100%',
      jwt: token,
      configOverwrite: { startWithAudioMuted: true, prejoinPageEnabled: false, enableWelcomePage: false },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: ['microphone', 'camera', 'chat', 'raisehand', 'tileview', 'hangup'],
        SHOW_JITSI_WATERMARK: false,
      },
    });
    api.addListener('videoConferenceJoined', () => {
      joinedAtRef.current = Date.now();
      setStatus(`Connected to ${room}`);
      void apiFetch('/api/v1/telemetry', accessToken, {
        method: 'POST',
        body: JSON.stringify({ eventType: 'CONFERENCE_JOINED', meetingId, userId: attendeeId, timestamp: Date.now() }),
      });
    });
    api.addListener('readyToClose', () => {
      setStatus('Room closed');
      if (joinedAtRef.current) {
        void apiFetch('/api/v1/attendance', accessToken, {
          method: 'POST',
          body: JSON.stringify({
            meetingId,
            userId: attendeeId,
            joinedAt: new Date(joinedAtRef.current).toISOString(),
            leftAt: new Date().toISOString(),
            presenceSeconds: Math.round((Date.now() - joinedAtRef.current) / 1000),
          }),
        });
      }
    });
    jitsiApiRef.current = api;
  }

  async function launch(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data: Meeting = await apiFetch('/api/v1/rooms/token', accessToken, {
        method: 'POST',
        body: JSON.stringify({ roomName, userId, userName: displayName, email: roomEmail, title: `${roomName} training` }),
      });
      setMeeting(data);
      setStatus(`Launching ${data.roomName}`);
      await startJitsi(data.roomName, data.token, data.meetingId, userId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to launch room');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="training-layout">
      <form className="feature-card" onSubmit={launch}>
        <p className="viewer-kicker">Virtual training room</p>
        <h3>Join a secure Jitsi session</h3>
        <label>Room name<input value={roomName} onChange={(event) => setRoomName(event.target.value)} /></label>
        <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label>Email<input type="email" value={roomEmail} onChange={(event) => setRoomEmail(event.target.value)} /></label>
        <button type="submit" disabled={busy}>{busy ? 'Launching…' : 'Launch training room'}</button>
        <p className="muted">{status}</p>
      </form>
      <div className="jitsi-panel" ref={containerRef}>
        <div className="empty-state">
          <strong>{meeting ? meeting.roomName : 'Meeting preview'}</strong>
          <span>{meeting ? `Jitsi: ${meeting.jitsiDomain}` : 'Launch a room to begin'}</span>
        </div>
      </div>
    </section>
  );
}
