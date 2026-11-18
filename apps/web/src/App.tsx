import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import QRCode from 'qrcode';

import { ApiError, apiFetch } from './api';
import { readStoredPortal, storePortal, type Portal } from './portal';
import { RoleSelector } from './RoleSelector';
import ModuleOneNav from './facilitator/ModuleOneNav';
import StudyFlashcards from './facilitator/StudyFlashcards';
import AttendanceData from './facilitator/AttendanceData';
import ReachOutInbox from './facilitator/ReachOutInbox';
import AppFooter from './layout/AppFooter';
import LegalPage from './legal/LegalPage';
import VerifyUserPage from './discord/VerifyUserPage';
import { handleLinkClick, navigate, parseDiscordRoute, parseFacilitatorRoute, parseLegalRoute, parseStudentRoute, usePathname } from './router';
import DiscordInvite from './student/DiscordInvite';
import GuideReader from './student/GuideReader';
import MentalHealthHub from './student/MentalHealthHub';
import ReachOut from './student/ReachOut';

type ModuleKey = 'module1' | 'student';
type Module1Role = 'admin' | 'facilitator';
type StudentRole = 'student';
type Role = Module1Role | StudentRole | 'participant';
type View = 'overview' | 'qr' | 'scanner' | 'training';

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

const jitsiDomain = import.meta.env.VITE_JITSI_DOMAIN ?? 'meet.jit.si';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const demoRole = new URLSearchParams(window.location.search).get('role');
const localDemoRole: Role = demoRole === 'student' || demoRole === 'participant' ? demoRole : 'facilitator';
const notAllowlistedNotice = 'This account is not listed as an approved Daraja facilitator. Please sign in with your registered Daraja email or switch to the Student Portal.';

const studentNav: Array<{ key: 'overview' | 'hub' | 'reach-out'; label: string; path: string }> = [
  { key: 'overview', label: 'Overview', path: '/student' },
  { key: 'hub', label: 'Mental health hub', path: '/student/hub' },
  { key: 'reach-out', label: 'Reach out', path: '/student/reach-out' },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [accessNotice, setAccessNotice] = useState('');
  const [portal, setPortal] = useState<Portal | null>(readStoredPortal);
  const [moduleTab, setModuleTab] = useState<ModuleKey>(readStoredPortal() === 'student' ? 'student' : 'module1');
  const [module1Role, setModule1Role] = useState<Module1Role>('facilitator');
  const [studentRole, setStudentRole] = useState<StudentRole>('student');
  const [view, setView] = useState<View>('overview');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
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

  const pathname = usePathname();
  const legalPage = parseLegalRoute(pathname);
  const discordRoute = parseDiscordRoute(pathname);
  const studentRoute = parseStudentRoute(pathname);
  const facilitatorRoute = parseFacilitatorRoute(pathname);
  const module: ModuleKey = studentRoute ? 'student' : facilitatorRoute ? 'module1' : moduleTab;
  const activeModule1Key = facilitatorRoute?.kind ?? view;

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
      setAccessNotice('');
      setUser(data.user);
      if (data.user.role === 'admin' || data.user.role === 'facilitator') {
        setModule1Role(data.user.role);
      }
    }).catch((error: unknown) => {
      if (isDemo) {
        setUser({ id: '00000000-0000-4000-8000-000000000001', role: 'facilitator', name: 'Local facilitator' });
        return;
      }
      // An unapproved Google account is signed out of Module 1 with guidance.
      if (error instanceof ApiError && error.status === 403 && error.payload?.error === 'NOT_ALLOWLISTED') {
        setAccessNotice(notAllowlistedNotice);
        void supabase?.auth.signOut();
      }
    });
  }, [accessToken, isDemo, session]);

  useEffect(() => {
    if (module !== 'module1' || !user || !canFacilitate) return;
    void apiFetch('/api/v1/facilitator/dashboard', accessToken).then(setDashboard).catch(() => setStatus('Dashboard data unavailable'));
  }, [accessToken, canFacilitate, module, user]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

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

  async function signInWithGoogle() {
    if (!supabase) return;
    setAuthError('');
    setAccessNotice('');
    const result = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (result.error) setAuthError(result.error.message);
  }

  // Same flow as Google: Supabase returns to this origin with a session, and the
  // existing /api/v1/auth/me hydration (including 403 NOT_ALLOWLISTED sign-out)
  // decides whether the account may use the facilitator workspace.
  async function signInWithDiscord() {
    if (!supabase) return;
    setAuthError('');
    setAccessNotice('');
    const result = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.origin },
    });
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

  function selectPortal(next: Portal) {
    storePortal(next);
    setPortal(next);
    setModuleTab(next === 'student' ? 'student' : 'module1');
    setView('overview');
    const keepsRoute = next === 'student' ? Boolean(studentRoute) : Boolean(facilitatorRoute);
    if (!keepsRoute) navigate(next === 'student' ? '/student' : '/');
  }

  function switchRole() {
    storePortal(null);
    setPortal(null);
  }

  const nav = useMemo(
    () => [
      ['overview', 'Overview'],
      ['qr', 'QR check-in'],
      ['scanner', 'Admin scanner'],
      ['training', 'Training room'],
    ] as Array<[View, string]>,
    []
  );
  const activeStudentKey = studentRoute ? (studentRoute.kind === 'guide' ? 'hub' : studentRoute.kind) : 'overview';
  const module1Title =
    facilitatorRoute?.kind === 'flashcards'
      ? 'Study flashcards'
      : facilitatorRoute?.kind === 'data'
        ? 'Attendance data'
        : facilitatorRoute?.kind === 'reach-out'
          ? 'Reach-out inbox'
          : nav.find(([key]) => key === view)?.[1] ?? 'Workspace';

  // Public legal pages come before the role gate: Discord's app review opens
  // them cold, with no portal choice and no session.
  if (legalPage) return <LegalPage page={legalPage} />;

  // Discord's Linked Roles verification URL. Public like the legal pages: the
  // Discord sign-in and the badge write happen inside the page itself.
  if (discordRoute) return <VerifyUserPage client={supabase} session={session} />;

  if (!portal) return <RoleSelector onSelect={selectPortal} />;

  const showModule1Auth = module === 'module1' && !user && supabase;

  if (showModule1Auth) {
    return (
      <main className="auth-shell">
        <div className="auth-stack">
          <form className="auth-card" onSubmit={signIn}>
            <img className="brand-badge" src="/daraja-logo.png" alt="" />
            <p className="eyebrow">Daraja Netizens</p>
            <h1>Module 1 access</h1>
            <p className="muted">Sign in to access the facilitator and admin training workspace.</p>
            {accessNotice && <p className="notice-banner" role="alert">{accessNotice}</p>}
            <div className="oauth-buttons">
              <button type="button" className="google-button" onClick={() => void signInWithGoogle()}>Sign in with Google</button>
              <button type="button" className="discord-button" onClick={() => void signInWithDiscord()}>Sign in with Discord</button>
            </div>
            <p className="auth-divider">or use your Daraja email</p>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {authError && <p className="error-text">{authError}</p>}
            <button type="submit">Sign in</button>
            <button type="button" className="ghost-button" onClick={switchRole}>Switch role</button>
          </form>
          <AppFooter />
        </div>
      </main>
    );
  }

  return (
    <main className={module === 'module1' ? 'app-shell with-fab-nav' : 'app-shell'}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="app-sidebar">
        <div className="brand-wrap">
          <img className="brand-badge" src="/daraja-logo.png" alt="" />
          <div>
            <p className="eyebrow">Module workspace</p>
            <h1>Daraja Netizens</h1>
          </div>
        </div>

        <div className="module-switcher">
          <button
            type="button"
            className={module === 'module1' ? 'module-button active' : 'module-button'}
            onClick={() => selectPortal('facilitator')}
          >
            Module 1
          </button>
          <button
            type="button"
            className={module === 'student' ? 'module-button active' : 'module-button'}
            onClick={() => selectPortal('student')}
          >
            Student portal
          </button>
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
          {module === 'module1'
            ? <>
                {nav.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={activeModule1Key === key ? 'side-link active' : 'side-link'}
                    onClick={() => {
                      setView(key);
                      if (facilitatorRoute) navigate('/');
                    }}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  className={activeModule1Key === 'data' ? 'side-link active' : 'side-link'}
                  onClick={() => navigate('/facilitator/data')}
                >
                  Attendance data
                </button>
              </>
            : studentNav.map((item) => (
                <a
                  key={item.key}
                  href={item.path}
                  className={activeStudentKey === item.key ? 'side-link active' : 'side-link'}
                  aria-current={activeStudentKey === item.key ? 'page' : undefined}
                  onClick={(event) => handleLinkClick(event, item.path)}
                >
                  {item.label}
                </a>
              ))}
        </nav>

        <div className="status-box">
          <span className="status-label">System status</span>
          <strong>{status}</strong>
        </div>
      </aside>

      <section className="content-panel" id="main-content" tabIndex={-1}>
        <header className="content-header">
          <div>
            <p className="viewer-kicker">{module === 'module1' ? 'Facilitator and admin console' : 'Student learning space'}</p>
            <h2>
              {module === 'module1' ? module1Title : studentNav.find((item) => item.key === activeStudentKey)?.label ?? 'Student portal'}
            </h2>
          </div>
          <div className="header-actions">
            <span className={module === 'module1' ? 'module-badge indigo' : 'module-badge sage'}>
              {module === 'module1' ? 'Module 1 · Facilitator/Admin' : 'Student Portal'}
            </span>
            <span className="live-indicator"><i />{module === 'module1' ? 'Secure session' : 'Public learning portal'}</span>
            <button type="button" className="pill-button" onClick={switchRole}>Switch role</button>
            {module === 'module1' && supabase && <button type="button" className="pill-button" onClick={() => void supabase.auth.signOut()}>Sign out</button>}
          </div>
        </header>

        {module === 'module1' && user && !canFacilitate ? (
          <section className="overview">
            <div className="feature-card" role="alert">
              <p className="viewer-kicker">Restricted area</p>
              <h3>This workspace is for facilitators and admins.</h3>
              <p className="muted">
                Your account is not on the facilitator roster, so attendance, QR check-in and the reach-out inbox are
                not available here. The Student Portal stays open to you.
              </p>
              <button type="button" onClick={() => selectPortal('student')}>Open the Student Portal</button>
            </div>
          </section>
        ) : module === 'module1' ? (
          facilitatorRoute?.kind === 'data'
            ? <AttendanceData accessToken={accessToken} />
            : facilitatorRoute?.kind === 'flashcards'
              ? <StudyFlashcards />
              : facilitatorRoute?.kind === 'reach-out'
                ? <ReachOutInbox accessToken={accessToken} currentUserId={user?.id} />
                : <>
            {view === 'overview' && <Overview dashboard={dashboard} canFacilitate={canFacilitate} />}
            {view === 'qr' && <section className="feature-grid"><div className="feature-card"><p className="viewer-kicker">Physical attendance</p><h3>Generate one-time check-in</h3><p className="muted">Display this challenge on the facilitator screen. It expires after sixty seconds and can only be redeemed once.</p><input placeholder="Training session UUID" value={sessionId} onChange={(event) => setSessionId(event.target.value)} /><button type="button" onClick={generateQr} disabled={isBusy}>Generate QR challenge</button></div><div className="qr-card">{qrImage ? <><img src={qrImage} alt="Attendance QR code" className="qr-image" /><code>{qrToken}</code></> : <span className="muted">Your active QR challenge will appear here.</span>}</div></section>}
            {view === 'scanner' && <section className="feature-grid"><div className="feature-card"><p className="viewer-kicker">Admin scanner mode</p><h3>Scan facilitator check-ins</h3><p className="muted">Allow camera access to scan a one-time challenge, or use the manual token fallback. Most modern Chromium browsers support camera-based QR decoding; otherwise, use the manual token entry.</p><div className="scanner-frame"><video ref={videoRef} className="scanner-video" muted playsInline /><span>{cameraStatus}</span></div><button type="button" onClick={() => void startCamera()}>Start camera scanner</button><form onSubmit={redeemQr}><input placeholder="Paste QR token" value={scanToken} onChange={(event) => setScanToken(event.target.value)} required /><button type="submit">Record attendance</button></form></div><div className="feature-card"><h3>Scanner safeguards</h3><ul className="check-list"><li>Token expiry is enforced by the API.</li><li>Redeemed tokens cannot be reused.</li><li>Attendance writes are tied to the signed-in user.</li><li>Browsers without BarcodeDetector automatically fall back to manual token entry.</li></ul></div></section>}
            {view === 'training' && <section className="training-layout"><form className="feature-card" onSubmit={launchRoom}><p className="viewer-kicker">Virtual training room</p><h3>Join a secure Jitsi session</h3><label>Room name<input value={roomName} onChange={(event) => setRoomName(event.target.value)} /></label><label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label>Email<input type="email" value={roomEmail} onChange={(event) => setRoomEmail(event.target.value)} /></label><button type="submit" disabled={isBusy}>{isBusy ? 'Launching…' : 'Launch training room'}</button></form><div className="jitsi-panel" ref={containerRef}><div className="empty-state"><strong>{meeting ? meeting.roomName : 'Meeting preview'}</strong><span>{meeting ? `Jitsi: ${meeting.jitsiDomain}` : 'Launch a room to begin'}</span></div></div></section>}
          </>
        ) : (
          <>
            {studentRoute?.kind === 'overview' && (
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
                  <a className="feature-card portal-link-card" href="/student/hub" onClick={(event) => handleLinkClick(event, '/student/hub')}>
                    <p className="viewer-kicker">Mental health hub</p>
                    <h3>Guides for real life</h3>
                    <p className="muted">Youth-friendly guides on anxiety, low moods, boundaries, grief, digital wellbeing and supporting a friend — written at your pace.</p>
                    <span className="read-guide">Open the hub →</span>
                  </a>
                  <a className="feature-card portal-link-card" href="/student/reach-out" onClick={(event) => handleLinkClick(event, '/student/reach-out')}>
                    <p className="viewer-kicker">Confidential reach-out</p>
                    <h3>Talk to a wellness supporter</h3>
                    <p className="muted">Reach the Daraja wellness team by WhatsApp, phone call, SMS or email. You can use a nickname, or stay anonymous.</p>
                    <span className="read-guide">Reach out →</span>
                  </a>
                </div>
                <DiscordInvite />
              </section>
            )}
            {studentRoute?.kind === 'hub' && <MentalHealthHub />}
            {studentRoute?.kind === 'guide' && <GuideReader slug={studentRoute.slug} />}
            {studentRoute?.kind === 'reach-out' && <ReachOut />}
          </>
        )}
        <AppFooter />
      </section>

      {module === 'module1' && (
        <ModuleOneNav
          active={activeModule1Key}
          onSelect={(key) => {
            if (key === 'flashcards' || key === 'data' || key === 'reach-out') {
              navigate(`/facilitator/${key}`);
              return;
            }
            setView(key);
            navigate('/');
          }}
        />
      )}
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
