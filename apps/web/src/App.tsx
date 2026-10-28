import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import QRCode from 'qrcode';

type ModuleKey = 'module1' | 'student';
type Module1Role = 'admin' | 'facilitator';
type StudentRole = 'student';
type Role = Module1Role | StudentRole | 'participant';
type View = 'overview' | 'qr' | 'scanner' | 'training' | 'library';

type AppUser = { id: string; email?: string; role: Role; name?: string };
type Dashboard = {
  stats: { physicalSessions: number; onlineSessions: number; attendanceRate: number; trainingProgress: number; stipendProgress: number };
  sessions: Array<{ id: string; title: string; session_type: string; scheduled_at: string; status: string }>;
};

type JitsiApi = {
  dispose: () => void;
  addListener: (eventName: string, callback: (data?: unknown) => void) => void;
};

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
const jitsiDomain = import.meta.env.VITE_JITSI_DOMAIN ?? 'meet.jit.si';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const demoRole = new URLSearchParams(window.location.search).get('role');
const localDemoRole: Role = demoRole === 'student' || demoRole === 'participant' ? demoRole : 'facilitator';

async function apiFetch(path: string, accessToken: string | null, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Request failed');
  return response.json();
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [module, setModule] = useState<ModuleKey>('module1');
  const [module1Role, setModule1Role] = useState<Module1Role>('facilitator');
  const [studentRole, setStudentRole] = useState<StudentRole>('student');
  const [view, setView] = useState<View>('overview');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [content, setContent] = useState<Array<{ id: string; title: string; summary: string; url: string; category: string }>>([]);
  const [support, setSupport] = useState<Array<{ id: string; label: string; channel: string; value: string }>>([]);
  const [status, setStatus] = useState('Ready for a secure session');
  const [roomName, setRoomName] = useState('daraja-training-room');
  const [displayName, setDisplayName] = useState('Facilitator');
  const [roomEmail, setRoomEmail] = useState('facilitator@daraja.local');
  const [sessionId, setSessionId] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [qrImage, setQrImage] = useState('');
  const [scanToken, setScanToken] = useState('');
  const [cameraStatus, setCameraStatus] = useState('Camera is off');
  const [isBusy, setIsBusy] = useState(false);
  const [meeting, setMeeting] = useState<{ roomName: string; meetingId: string; token: string; jitsiDomain: string } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const jitsiApiRef = useRef<JitsiApi | null>(null);
  const joinedAtRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const accessToken = session?.access_token ?? null;
  const isDemo = !supabase;
  const userRole = user?.role ?? (module === 'module1' ? module1Role : studentRole);
  const canFacilitate = module === 'module1' && (userRole === 'admin' || userRole === 'facilitator');

  useEffect(() => {
    if (!supabase) {
      setUser({
        id: '00000000-0000-4000-8000-000000000001',
        role: localDemoRole,
        name: localDemoRole === 'facilitator' ? 'Local facilitator' : 'Local student',
      });
      return;
    }
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session && supabase) {
      setUser(null);
      return;
    }
    if (!session && !isDemo) return;
    void apiFetch('/api/v1/auth/me', accessToken).then((data) => {
      setUser(data.user);
      if (data.user.role === 'admin' || data.user.role === 'facilitator') {
        setModule1Role(data.user.role);
      }
    }).catch(() => {
      if (isDemo) {
        setUser({ id: '00000000-0000-4000-8000-000000000001', role: 'facilitator', name: 'Local facilitator' });
      }
    });
  }, [accessToken, isDemo, session]);

  useEffect(() => {
    if (module === 'module1') {
      if (!user) return;
      if (canFacilitate) {
        void apiFetch('/api/v1/facilitator/dashboard', accessToken).then(setDashboard).catch(() => setStatus('Dashboard data unavailable'));
      }
      return;
    }

    void apiFetch('/api/v1/content', accessToken).then((data) => setContent(data.items ?? data)).catch(() => setStatus('Learning library unavailable'));
    void apiFetch('/api/v1/support/contacts', accessToken).then((data) => setSupport(data.contacts ?? data)).catch(() => setStatus('Support contacts unavailable'));
  }, [accessToken, canFacilitate, module, user]);

  useEffect(() => {
    if (module === 'student') {
      setView('overview');
    }
  }, [module]);

  useEffect(() => {
    if (!qrToken) {
      setQrImage('');
      return;
    }

    let active = true;
    QRCode.toDataURL(qrToken, {
      margin: 1,
      width: 220,
      errorCorrectionLevel: 'M',
    }).then((dataUrl: string) => {
      if (active) setQrImage(dataUrl);
    }).catch(() => {
      if (active) setQrImage('');
    });

    return () => {
      active = false;
    };
  }, [qrToken]);

  useEffect(() => () => {
    jitsiApiRef.current?.dispose();
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setAuthError('');
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setAuthError(result.error.message);
  }

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
    const JitsiMeetExternalAPI = (window as typeof window & { JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApi }).JitsiMeetExternalAPI;
    if (!JitsiMeetExternalAPI) throw new Error('Jitsi external API unavailable');
    jitsiApiRef.current?.dispose();
    const api = new JitsiMeetExternalAPI(jitsiDomain, {
      roomName: room, parentNode: containerRef.current, width: '100%', height: '100%', jwt: token,
      configOverwrite: { startWithAudioMuted: true, prejoinPageEnabled: false, enableWelcomePage: false },
      interfaceConfigOverwrite: { TOOLBAR_BUTTONS: ['microphone', 'camera', 'chat', 'raisehand', 'tileview', 'hangup'], SHOW_JITSI_WATERMARK: false },
    });
    api.addListener('videoConferenceJoined', () => {
      joinedAtRef.current = Date.now();
      setStatus(`Connected to ${room}`);
      void apiFetch('/api/v1/telemetry', accessToken, { method: 'POST', body: JSON.stringify({ eventType: 'CONFERENCE_JOINED', meetingId, userId: attendeeId, timestamp: Date.now() }) });
    });
    api.addListener('readyToClose', () => {
      setStatus('Room closed');
      if (joinedAtRef.current) void apiFetch('/api/v1/attendance', accessToken, { method: 'POST', body: JSON.stringify({ meetingId, userId: attendeeId, joinedAt: new Date(joinedAtRef.current).toISOString(), leftAt: new Date().toISOString(), presenceSeconds: Math.round((Date.now() - joinedAtRef.current) / 1000) }) });
    });
    jitsiApiRef.current = api;
  }

  async function launchRoom(event: FormEvent) {
    event.preventDefault();
    setIsBusy(true);
    try {
      const data = await apiFetch('/api/v1/rooms/token', accessToken, { method: 'POST', body: JSON.stringify({ roomName, userId: user?.id ?? crypto.randomUUID(), userName: displayName, email: roomEmail, title: `${roomName} training` }) });
      setMeeting(data);
      setStatus(`Launching ${data.roomName}`);
      await startJitsi(data.roomName, data.token, data.meetingId, user?.id ?? '');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to launch room');
    } finally {
      setIsBusy(false);
    }
  }

  async function generateQr() {
    if (!sessionId) return setStatus('Enter a training session ID first');
    setIsBusy(true);
    try {
      const data = await apiFetch('/api/v1/attendance/qr', accessToken, { method: 'POST', body: JSON.stringify({ sessionId }) });
      setQrToken(data.token);
      setStatus('One-time QR challenge generated');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to generate QR');
    } finally {
      setIsBusy(false);
    }
  }

  async function redeemQr(event: FormEvent) {
    event.preventDefault();
    try {
      await apiFetch('/api/v1/attendance/qr/redeem', accessToken, { method: 'POST', body: JSON.stringify({ token: scanToken }) });
      setStatus('Attendance recorded successfully');
      setScanToken('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'QR scan failed');
    }
  }

  async function startCamera() {
    if (!videoRef.current || !('mediaDevices' in navigator)) {
      setCameraStatus('Camera unavailable; use manual token entry');
      return;
    }
    const detector = (window as typeof window & { BarcodeDetector?: new () => BarcodeDetectorLike }).BarcodeDetector;
    if (!detector) {
      setCameraStatus('QR camera decoding is not supported in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      cameraStreamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraStatus('Scanning for a QR challenge…');
      const scanner = new detector();
      const scan = async () => {
        if (!videoRef.current || !cameraStreamRef.current) return;
        const codes = await scanner.detect(videoRef.current);
        const token = codes.find((code) => code.rawValue)?.rawValue;
        if (token) {
          setScanToken(token);
          setCameraStatus('QR captured. Submit to record attendance.');
          cameraStreamRef.current.getTracks().forEach((track) => track.stop());
          cameraStreamRef.current = null;
          return;
        }
        window.setTimeout(() => void scan(), 500);
      };
      void scan();
    } catch {
      setCameraStatus('Camera permission was denied; use manual token entry');
    }
  }

  const nav = useMemo(() => module === 'module1'
    ? [['overview', 'Overview'], ['qr', 'QR check-in'], ['scanner', 'Admin scanner'], ['training', 'Training room']]
    : [['overview', 'Overview'], ['library', 'Learning hub']], [module]);

  const showModule1Auth = module === 'module1' && !user && supabase;

  if (showModule1Auth) {
    return (
      <main className="auth-shell">
        <form className="auth-card" onSubmit={signIn}>
          <div className="brand-badge">D</div>
          <p className="eyebrow">Daraja Netizens</p>
          <h1>Module 1 access</h1>
          <p className="muted">Sign in to access the facilitator and admin training workspace.</p>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {authError && <p className="error-text">{authError}</p>}
          <button type="submit">Sign in</button>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-wrap">
          <div className="brand-badge">D</div>
          <div>
            <p className="eyebrow">Module workspace</p>
            <h1>Daraja Netizens</h1>
          </div>
        </div>

        <div className="module-switcher">
          <button type="button" className={module === 'module1' ? 'module-button active' : 'module-button'} onClick={() => setModule('module1')}>Module 1</button>
          <button type="button" className={module === 'student' ? 'module-button active' : 'module-button'} onClick={() => setModule('student')}>Student portal</button>
        </div>

        {module === 'module1' ? (
          <div className="user-card">
            <span className="avatar">{(user?.name ?? 'D').slice(0, 1)}</span>
            <div>
              <strong>{user?.name ?? 'Daraja facilitator'}</strong>
              <select value={module1Role} onChange={(event) => setModule1Role(event.target.value as Module1Role)} aria-label="Select module 1 role">
                <option value="facilitator">Facilitator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="user-card">
            <span className="avatar">S</span>
            <div>
              <strong>Student portal</strong>
              <select value={studentRole} onChange={(event) => setStudentRole(event.target.value as StudentRole)} aria-label="Select student portal role">
                <option value="student">Training graduate</option>
              </select>
            </div>
          </div>
        )}

        <nav className="side-nav" aria-label="Workspace navigation">
          {nav.map(([key, label]) => (
            <button key={key} type="button" className={view === key ? 'side-link active' : 'side-link'} onClick={() => setView(key as View)}>{label}</button>
          ))}
        </nav>

        <div className="status-box">
          <span className="status-label">System status</span>
          <strong>{status}</strong>
        </div>
        {module === 'module1' && supabase && <button className="ghost-button" type="button" onClick={() => void supabase.auth.signOut()}>Sign out</button>}
      </aside>

      <section className="content-panel">
        <header className="content-header">
          <div>
            <p className="viewer-kicker">{module === 'module1' ? 'Facilitator and admin console' : 'Student learning space'}</p>
            <h2>{nav.find(([key]) => key === view)?.[1] ?? 'Workspace'}</h2>
          </div>
          <span className="live-indicator"><i />{module === 'module1' ? 'Secure session' : 'Public learning portal'}</span>
        </header>

        {module === 'module1' ? (
          <>
            {view === 'overview' && <Overview dashboard={dashboard} canFacilitate={canFacilitate} />}
            {view === 'qr' && <section className="feature-grid"><div className="feature-card"><p className="viewer-kicker">Physical attendance</p><h3>Generate one-time check-in</h3><p className="muted">Display this challenge on the facilitator screen. It expires after sixty seconds and can only be redeemed once.</p><input placeholder="Training session UUID" value={sessionId} onChange={(event) => setSessionId(event.target.value)} /><button type="button" onClick={generateQr} disabled={isBusy}>Generate QR challenge</button></div><div className="qr-card">{qrImage ? <><img src={qrImage} alt="Attendance QR code" className="qr-image" /><code>{qrToken}</code></> : <span className="muted">Your active QR challenge will appear here.</span>}</div></section>}
            {view === 'scanner' && <section className="feature-grid"><div className="feature-card"><p className="viewer-kicker">Admin scanner mode</p><h3>Scan facilitator check-ins</h3><p className="muted">Allow camera access to scan a one-time challenge, or use the manual token fallback. Most modern Chromium browsers support camera-based QR decoding; otherwise, use the manual token entry.</p><div className="scanner-frame"><video ref={videoRef} className="scanner-video" muted playsInline /><span>{cameraStatus}</span></div><button type="button" onClick={() => void startCamera()}>Start camera scanner</button><form onSubmit={redeemQr}><input placeholder="Paste QR token" value={scanToken} onChange={(event) => setScanToken(event.target.value)} required /><button type="submit">Record attendance</button></form></div><div className="feature-card"><h3>Scanner safeguards</h3><ul className="check-list"><li>Token expiry is enforced by the API.</li><li>Redeemed tokens cannot be reused.</li><li>Attendance writes are tied to the signed-in user.</li><li>Browsers without BarcodeDetector automatically fall back to manual token entry.</li></ul></div></section>}
            {view === 'training' && <section className="training-layout"><form className="feature-card" onSubmit={launchRoom}><p className="viewer-kicker">Virtual training room</p><h3>Join a secure Jitsi session</h3><label>Room name<input value={roomName} onChange={(event) => setRoomName(event.target.value)} /></label><label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>Email<input type="email" value={roomEmail} onChange={(event) => setRoomEmail(event.target.value)} /></label><button type="submit" disabled={isBusy}>{isBusy ? 'Launching…' : 'Launch training room'}</button></form><div className="jitsi-panel" ref={containerRef}><div className="empty-state"><strong>{meeting ? meeting.roomName : 'Meeting preview'}</strong><span>{meeting ? `Jitsi: ${meeting.jitsiDomain}` : 'Launch a room to begin'}</span></div></div></section>}
          </>
        ) : (
          <>
            {view === 'overview' && (
              <section className="overview">
                <div className="hero-card">
                  <div>
                    <p className="viewer-kicker">Student learning path</p>
                    <h3>Keep learning with the Daraja community.</h3>
                    <p className="muted">This portal is for students who have completed their training and want to access Daraja learning materials and follow the work we are doing.</p>
                  </div>
                  <span className="hero-orb">✦</span>
                </div>
                <div className="feature-grid">
                  <div className="feature-card">
                    <p className="viewer-kicker">Learning resources</p>
                    <h3>Access the latest material</h3>
                    <p className="muted">Browse structured lessons, updates, and community resources from the Daraja learning library.</p>
                  </div>
                  <div className="feature-card">
                    <p className="viewer-kicker">Follow our work</p>
                    <h3>Stay close to the programme</h3>
                    <p className="muted">Check updates, support points, and learning links curated for students after training.</p>
                  </div>
                </div>
              </section>
            )}
            {view === 'library' && <section className="library-grid">{content.length ? content.map((item) => <a className="content-card" key={item.id} href={item.url} target="_blank" rel="noreferrer"><span className="tag">{item.category}</span><h3>{item.title}</h3><p>{item.summary}</p></a>) : <div className="empty-state">Learning content is being prepared for the student portal.</div>}<div className="support-card"><p className="viewer-kicker">Wellness support</p><h3>You do not have to navigate difficult moments alone.</h3><p className="muted">Connect with a professional support partner.</p>{support.length ? support.map((item) => <a key={item.id} href={item.channel === 'url' ? item.value : `${item.channel}:${item.value}`}>{item.label}</a>) : <span className="muted">Support contacts are being configured.</span>}</div></section>}
          </>
        )}
      </section>
    </main>
  );
}

function Overview({ dashboard, canFacilitate }: { dashboard: Dashboard | null; canFacilitate: boolean }) {
  const stats = dashboard?.stats ?? { physicalSessions: 0, onlineSessions: 0, attendanceRate: 0, trainingProgress: 0, stipendProgress: 0 };
  return (
    <section className="overview">
      <div className="hero-card">
        <div>
          <p className="viewer-kicker">{canFacilitate ? 'Operations overview' : 'Your progress'}</p>
          <h3>{canFacilitate ? 'Keep every session accountable.' : 'Keep learning, one session at a time.'}</h3>
          <p className="muted">{canFacilitate ? 'Track physical check-ins, online presence, and eligibility from one workspace.' : 'Your attendance and learning resources are always within reach.'}</p>
        </div>
        <span className="hero-orb">✦</span>
      </div>
      <div className="metric-grid">
        <Metric label="Attendance rate" value={`${stats.attendanceRate}%`} />
        <Metric label="Physical sessions" value={String(stats.physicalSessions)} />
        <Metric label="Online sessions" value={String(stats.onlineSessions)} />
        <Metric label="Training progress" value={`${stats.trainingProgress}%`} />
      </div>
      <div className="progress-card">
        <div><span>Training eligibility</span><strong>{stats.trainingProgress}%</strong></div>
        <div className="progress-track"><span style={{ width: `${Math.min(stats.trainingProgress, 100)}%` }} /></div>
        <p className="muted">Eligibility is calculated from verified attendance records.</p>
      </div>
      <div className="progress-card">
        <div><span>Stipend progress</span><strong>{stats.stipendProgress}%</strong></div>
        <div className="progress-track accent-track"><span style={{ width: `${Math.min(stats.stipendProgress, 100)}%` }} /></div>
        <p className="muted">Physical session participation is tracked separately.</p>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong></div>;
}
