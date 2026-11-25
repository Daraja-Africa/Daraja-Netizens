import { useCallback, useEffect, useRef, useState } from 'react';

import {
  recordFinalAttendance,
  sendAttendanceHeartbeat,
  sendJitsiTelemetry,
} from '../api';

type JitsiEventPayload = Record<string, unknown>;

type JitsiApi = {
  dispose: () => void;
  addListener: (eventName: string, callback: (data?: JitsiEventPayload) => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
};

type JitsiConstructor = new (domain: string, options: Record<string, unknown>) => JitsiApi;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiConstructor;
  }
}

export type JitsiConferenceUser = { id: string; name: string; email: string };

export type JitsiConferenceProps = {
  accessToken: string;
  roomName: string;
  roomTitle?: string;
  meetingId: string;
  sessionId?: string | null;
  token?: string;
  requiresJitsiJwt?: boolean;
  user: JitsiConferenceUser;
  isModerator?: boolean;
  jitsiDomain?: string;
  onClosed?: () => void;
  onTelemetrySent?: (eventType: 'CONFERENCE_JOINED' | 'CONFERENCE_LEFT') => void;
};

const HEARTBEAT_SECONDS = 30;

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function eventDetails(data?: JitsiEventPayload) {
  if (!data) return {};
  return {
    participantId: typeof data.id === 'string' ? data.id : typeof data.participantId === 'string' ? data.participantId : undefined,
    displayName: typeof data.displayName === 'string' ? data.displayName : typeof data.name === 'string' ? data.name : undefined,
  };
}

function loadJitsiScript(domain: string) {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  const id = `jitsi-external-api-${domain.replace(/[^a-z0-9]/gi, '-')}`;
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  const script = existing ?? document.createElement('script');
  if (!existing) {
    script.id = id;
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    document.body.appendChild(script);
  }
  return new Promise<void>((resolve, reject) => {
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Unable to load the Jitsi connection service.')), { once: true });
  });
}

/** A self-contained Jitsi call with pre-join controls and verified presence tracking. */
export default function JitsiConference({
  accessToken,
  roomName,
  roomTitle = roomName,
  meetingId,
  sessionId,
  token,
  requiresJitsiJwt = false,
  user,
  isModerator = false,
  jitsiDomain = import.meta.env.VITE_JITSI_DOMAIN ?? 'meet.jit.si',
  onClosed,
  onTelemetrySent,
}: JitsiConferenceProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const joinedAtRef = useRef<number | null>(null);
  const lastHeartbeatRef = useRef<number | null>(null);
  const finalizedRef = useRef(false);
  const liveRef = useRef(false);
  const conferenceErrorRef = useRef(false);
  const [status, setStatus] = useState<'prejoin' | 'connecting' | 'connected' | 'error'>('prejoin');
  const [isFullWindow, setIsFullWindow] = useState(false);
  const [presenceSeconds, setPresenceSeconds] = useState(0);
  const [participants, setParticipants] = useState(1);
  const [preJoinMutedAudio, setPreJoinMutedAudio] = useState(true);
  const [preJoinMutedVideo, setPreJoinMutedVideo] = useState(true);
  const [permissionWarning, setPermissionWarning] = useState('');
  const [failure, setFailure] = useState('');
  const [isModeratorHere, setIsModeratorHere] = useState(isModerator);

  const stopTimers = useCallback(() => {
    if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current);
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    heartbeatRef.current = null;
    timerRef.current = null;
  }, []);

  const flushHeartbeat = useCallback((keepalive = false) => {
    const lastHeartbeat = lastHeartbeatRef.current;
    if (!liveRef.current || !lastHeartbeat) return;
    const seconds = Math.max(1, Math.floor((Date.now() - lastHeartbeat) / 1000));
    lastHeartbeatRef.current = Date.now();
    void sendAttendanceHeartbeat(accessToken, {
      meetingId,
      sessionId: sessionId ?? undefined,
      deltaSeconds: seconds,
      timestamp: new Date().toISOString(),
    }, { keepalive }).catch(() => undefined);
  }, [accessToken, meetingId, sessionId]);

  const finishConference = useCallback((reason: 'left' | 'closed' = 'closed') => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    const joinedAt = joinedAtRef.current;
    stopTimers();
    if (joinedAt) {
      flushHeartbeat();
      const leftAt = Date.now();
      const presence = Math.max(0, Math.floor((leftAt - joinedAt) / 1000));
      void recordFinalAttendance(accessToken, {
        meetingId,
        userId: user.id,
        joinedAt: new Date(joinedAt).toISOString(),
        leftAt: new Date(leftAt).toISOString(),
        presenceSeconds: presence,
      }).catch(() => undefined);
      void sendJitsiTelemetry(accessToken, {
        eventType: 'CONFERENCE_LEFT', meetingId, userId: user.id, timestamp: leftAt, payload: { reason },
      }).then(() => onTelemetrySent?.('CONFERENCE_LEFT')).catch(() => undefined);
    }
    liveRef.current = false;
    setStatus(conferenceErrorRef.current ? 'error' : 'prejoin');
    onClosed?.();
  }, [accessToken, flushHeartbeat, meetingId, onClosed, onTelemetrySent, stopTimers, user.id]);

  const inspectPermissions = useCallback(async () => {
    if (!navigator.mediaDevices) {
      setPermissionWarning('This browser cannot check microphone or camera access. You can still join muted to listen.');
      return;
    }
    if (!navigator.permissions?.query) return;
    try {
      const [microphone, camera] = await Promise.all([
        navigator.permissions.query({ name: 'microphone' as PermissionName }),
        navigator.permissions.query({ name: 'camera' as PermissionName }),
      ]);
      if (microphone.state === 'denied' || camera.state === 'denied') {
        setPermissionWarning('Microphone or camera access is blocked. You can still join audio-muted and listen-only.');
      } else {
        setPermissionWarning('');
      }
    } catch {
      // Some browsers intentionally do not expose these permission states.
    }
  }, []);

  const dispose = useCallback(() => {
    stopTimers();
    apiRef.current?.dispose();
    apiRef.current = null;
  }, [stopTimers]);

  const startConference = useCallback(async () => {
    setFailure('');
    setStatus('connecting');
    finalizedRef.current = false;
    conferenceErrorRef.current = false;
    await inspectPermissions();
    try {
      await loadJitsiScript(jitsiDomain);
      const JitsiMeetExternalAPI = window.JitsiMeetExternalAPI;
      if (!JitsiMeetExternalAPI) throw new Error('Jitsi is unavailable after the connection service loaded.');
      if (!frameRef.current) throw new Error('The Jitsi room could not be prepared. Please try again.');
      dispose();
      const api = new JitsiMeetExternalAPI(jitsiDomain, {
        roomName,
        parentNode: frameRef.current,
        width: '100%',
        height: '100%',
        ...(requiresJitsiJwt && token ? { jwt: token } : {}),
        userInfo: { displayName: user.name, email: user.email },
        configOverwrite: {
          prejoinConfig: { enabled: false },
          startWithAudioMuted: preJoinMutedAudio,
          startWithVideoMuted: preJoinMutedVideo,
          disableDeepLinking: true,
          toolbarButtons: ['microphone', 'camera', 'chat', 'raisehand', 'tileview', 'hangup'],
        },
      });
      apiRef.current = api;
      api.addListener('videoConferenceJoined', () => {
        const now = Date.now();
        joinedAtRef.current = now;
        lastHeartbeatRef.current = now;
        finalizedRef.current = false;
        liveRef.current = true;
        setStatus('connected');
        setPresenceSeconds(0);
        void sendJitsiTelemetry(accessToken, {
          eventType: 'CONFERENCE_JOINED', meetingId, userId: user.id, timestamp: now,
        }).then(() => onTelemetrySent?.('CONFERENCE_JOINED')).catch(() => undefined);
        heartbeatRef.current = window.setInterval(() => {
          if (!liveRef.current) return;
          lastHeartbeatRef.current = Date.now();
          void sendAttendanceHeartbeat(accessToken, {
            meetingId, sessionId: sessionId ?? undefined, deltaSeconds: HEARTBEAT_SECONDS, timestamp: new Date().toISOString(),
          }).catch(() => undefined);
        }, HEARTBEAT_SECONDS * 1000);
        timerRef.current = window.setInterval(() => {
          if (joinedAtRef.current) setPresenceSeconds(Math.floor((Date.now() - joinedAtRef.current) / 1000));
        }, 1000);
      });
      api.addListener('participantJoined', (data) => {
        setParticipants((count) => count + 1);
        void sendJitsiTelemetry(accessToken, { eventType: 'PARTICIPANT_JOINED', meetingId, userId: user.id, timestamp: Date.now(), payload: eventDetails(data) }).catch(() => undefined);
      });
      api.addListener('participantLeft', (data) => {
        setParticipants((count) => Math.max(1, count - 1));
        void sendJitsiTelemetry(accessToken, { eventType: 'PARTICIPANT_LEFT', meetingId, userId: user.id, timestamp: Date.now(), payload: eventDetails(data) }).catch(() => undefined);
      });
      api.addListener('participantRoleChanged', (data) => {
        const role = typeof data?.role === 'string' ? data.role : 'participant';
        if (role === 'moderator') setIsModeratorHere(true);
        void sendJitsiTelemetry(accessToken, { eventType: 'ROLE_CHANGED', meetingId, userId: user.id, timestamp: Date.now(), payload: { ...eventDetails(data), role } }).catch(() => undefined);
      });
      const handleConferenceError = (data?: JitsiEventPayload) => {
        if (conferenceErrorRef.current) return;
        conferenceErrorRef.current = true;
        flushHeartbeat();
        stopTimers();
        liveRef.current = false;
        setStatus('error');
        setFailure('Jitsi could not connect to this room. Check your connection and try again.');
        void sendJitsiTelemetry(accessToken, { eventType: 'CONFERENCE_FAILED', meetingId, userId: user.id, timestamp: Date.now(), payload: data ?? {} }).catch(() => undefined);
      };
      api.addListener('videoConferenceFailed', handleConferenceError);
      api.addListener('errorOccurred', handleConferenceError);
      api.addListener('videoConferenceLeft', () => finishConference('left'));
      api.addListener('readyToClose', () => finishConference('closed'));
    } catch (error) {
      stopTimers();
      liveRef.current = false;
      setStatus('error');
      setFailure(error instanceof Error ? error.message : 'Unable to start the Jitsi room.');
      void sendJitsiTelemetry(accessToken, {
        eventType: 'CONFERENCE_FAILED', meetingId, userId: user.id, timestamp: Date.now(), payload: { error: error instanceof Error ? error.message : 'Unknown error' },
      }).catch(() => undefined);
    }
  }, [accessToken, dispose, finishConference, flushHeartbeat, inspectPermissions, jitsiDomain, meetingId, onTelemetrySent, preJoinMutedAudio, preJoinMutedVideo, requiresJitsiJwt, roomName, sessionId, stopTimers, token, user.email, user.id, user.name]);

  useEffect(() => {
    void inspectPermissions();
  }, [inspectPermissions]);

  useEffect(() => {
    const flushOnExit = () => flushHeartbeat(true);
    window.addEventListener('pagehide', flushOnExit);
    window.addEventListener('beforeunload', flushOnExit);
    return () => {
      window.removeEventListener('pagehide', flushOnExit);
      window.removeEventListener('beforeunload', flushOnExit);
      if (liveRef.current) finishConference('closed');
      dispose();
    };
  }, [dispose, finishConference, flushHeartbeat]);

  return (
    <section className={`jitsi-conference${isFullWindow ? ' jitsi-full-window' : ''}`} aria-label={`${roomTitle} video conference`}>
      <div className="jitsi-telemetry-bar">
        <div><span className="jitsi-label">Room</span><strong>{roomTitle}</strong></div>
        <span className={`jitsi-connection ${status}`}>{status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting' : status === 'error' ? 'Connection error' : 'Ready to join'}</span>
        <span>{participants} {participants === 1 ? 'participant' : 'participants'}</span>
        <span className="jitsi-presence">{formatDuration(presenceSeconds)}</span>
        <button type="button" className="jitsi-expand" onClick={() => setIsFullWindow((expanded) => !expanded)}>{isFullWindow ? 'Exit Full Window' : 'Expand Window'}</button>
        <button type="button" className="jitsi-leave" onClick={() => apiRef.current?.executeCommand('hangup')} disabled={status !== 'connected'}>Leave room</button>
      </div>

      {status === 'prejoin' && (
        <div className="jitsi-prejoin">
          <div>
            <p className="viewer-kicker">Ready to join</p>
            <h3>{roomTitle}</h3>
            <p className="muted">You will join as a {isModeratorHere ? 'Moderator' : 'Participant'}.</p>
          </div>
          <div className="jitsi-toggle-row">
            <label><input type="checkbox" checked={preJoinMutedAudio} onChange={(event) => setPreJoinMutedAudio(event.target.checked)} /> Join with mic muted</label>
            <label><input type="checkbox" checked={preJoinMutedVideo} onChange={(event) => setPreJoinMutedVideo(event.target.checked)} /> Join with camera off</label>
          </div>
          {permissionWarning && <p className="jitsi-warning" role="status">{permissionWarning}</p>}
          {jitsiDomain === 'meet.jit.si' && isModeratorHere && <p className="jitsi-note">If students see “Waiting for moderator”, use <strong>Log-in</strong> inside the Jitsi frame to unlock the room.</p>}
          <button type="button" onClick={() => void startConference()}>Join live room</button>
        </div>
      )}

      {failure && <div className="jitsi-recovery" role="alert"><strong>Connection interrupted</strong><span>{failure}</span><button type="button" onClick={() => void startConference()}>Retry Connection</button></div>}
      {status !== 'prejoin' && <div className="jitsi-panel" aria-live="polite">
        <div ref={frameRef} className="jitsi-mount" />
        {status === 'connecting' && <div className="jitsi-connecting-overlay"><strong>Connecting to {roomName}...</strong><span>Preparing your secure video room...</span></div>}
      </div>}
    </section>
  );
}
