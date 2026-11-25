import { useEffect, useState, type FormEvent } from 'react';

import { fetchActiveRooms, requestRoomToken, type ActiveRoom, type RoomTokenResponse } from '../api';
import { handleLinkClick, navigate, parseStudentRoute, usePathname } from '../router';
import JitsiConference from '../staff/JitsiConference';
import GuideReader from './GuideReader';
import MentalHealthHub from './MentalHealthHub';
import ReachOut from './ReachOut';

const studentNav: Array<{ key: 'overview' | 'hub' | 'reach-out'; label: string; path: string }> = [
  { key: 'overview', label: 'Overview', path: '/student' },
  { key: 'hub', label: 'Mental health hub', path: '/student/hub' },
  { key: 'reach-out', label: 'Reach out', path: '/student/reach-out' },
];

/** The public learning space. It has no staff navigation and needs no sign-in. */
type StudentIdentity = { id: string; name?: string; email?: string };

export default function StudentPortal({ accessToken = null, user, onSignIn }: { accessToken?: string | null; user?: StudentIdentity | null; onSignIn?: () => void }) {
  const pathname = usePathname();
  const route = parseStudentRoute(pathname);
  const activeKey = route ? (route.kind === 'guide' ? 'hub' : route.kind) : 'overview';

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-wrap">
          <img className="brand-badge" src="/daraja-logo.png" alt="" />
          <div>
            <p className="eyebrow">Daraja Netizens</p>
            <h1>Student portal</h1>
          </div>
        </div>

        <div className="user-card">
          <span className="avatar">S</span>
          <div>
            <strong>Student portal</strong>
            <span className="workspace-role">Training graduate</span>
          </div>
        </div>

        <nav className="side-nav" aria-label="Student portal navigation">
          {studentNav.map((item) => (
            <a
              key={item.key}
              href={item.path}
              className={activeKey === item.key ? 'side-link active' : 'side-link'}
              aria-current={activeKey === item.key ? 'page' : undefined}
              onClick={(event) => handleLinkClick(event, item.path)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="workspace-sidebar-actions">
          <button type="button" className="ghost-button" onClick={() => navigate('/')}>Switch role</button>
          <button type="button" className="ghost-button" onClick={() => navigate('/facilitator')}>Staff sign in</button>
        </div>

        <div className="status-box">
          <span className="status-label">Access</span>
          <strong>Public learning portal</strong>
        </div>
      </aside>

      <section className="content-panel">
        <header className="content-header">
          <div>
            <p className="viewer-kicker">Student learning space</p>
            <h2>{studentNav.find((item) => item.key === activeKey)?.label ?? 'Student portal'}</h2>
          </div>
          <div className="header-actions">
            <span className="module-badge sage">Student portal</span>
            <span className="live-indicator"><i />Public learning portal</span>
          </div>
        </header>

        {route?.kind === 'overview' && (
          <section className="overview">
            <div className="hero-card">
              <div>
                <p className="viewer-kicker">Student learning path</p>
                <h3>Keep learning with the Daraja community.</h3>
                <p className="muted">
                  This portal is for students who have completed their training and want to access Daraja learning
                  materials and follow the work we are doing.
                </p>
              </div>
              <span className="hero-orb">✦</span>
            </div>
            <div className="feature-grid">
              <a className="feature-card portal-link-card" href="/student/hub" onClick={(event) => handleLinkClick(event, '/student/hub')}>
                <p className="viewer-kicker">Mental health hub</p>
                <h3>Guides for real life</h3>
                <p className="muted">
                  Youth-friendly guides on anxiety, low moods, boundaries, grief, digital wellbeing and supporting a
                  friend — written at your pace.
                </p>
                <span className="read-guide">Open the hub →</span>
              </a>
              <a className="feature-card portal-link-card" href="/student/reach-out" onClick={(event) => handleLinkClick(event, '/student/reach-out')}>
                <p className="viewer-kicker">Confidential reach-out</p>
                <h3>Talk to a wellness supporter</h3>
                <p className="muted">
                  Reach the Daraja wellness team by WhatsApp, phone call, SMS or email. You can use a nickname, or stay
                  anonymous.
                </p>
                <span className="read-guide">Reach out →</span>
              </a>
            </div>
            <LiveTrainingSessions accessToken={accessToken} user={user} onSignIn={onSignIn} />
          </section>
        )}
        {route?.kind === 'hub' && <MentalHealthHub />}
        {route?.kind === 'guide' && <GuideReader slug={route.slug} />}
        {route?.kind === 'reach-out' && <ReachOut />}
      </section>
    </main>
  );
}

function LiveTrainingSessions({ accessToken, user, onSignIn }: { accessToken: string | null; user?: StudentIdentity | null; onSignIn?: () => void }) {
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<ActiveRoom | null>(null);
  const [meeting, setMeeting] = useState<RoomTokenResponse | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let current = true;
    void fetchActiveRooms(accessToken).then((data) => {
      if (current) setRooms(data.meetings);
    }).catch((error: unknown) => {
      if (current) setStatus(error instanceof Error ? error.message : 'Live sessions are unavailable right now.');
    });
    return () => { current = false; };
  }, [accessToken]);

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    const requestedName = selectedRoom?.room_key ?? roomCode.trim();
    if (!requestedName) {
      setStatus('Choose a live session or enter the room code shared by your facilitator.');
      return;
    }
    setBusy(true);
    try {
      const data = await requestRoomToken(accessToken, { roomName: requestedName, title: selectedRoom?.title });
      setMeeting(data);
      setStatus('Your live room is ready. Choose your audio and camera settings before joining.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to join this live room.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="live-training-section">
      <div className="live-training-heading">
        <div><p className="viewer-kicker">Live training sessions</p><h3>Join your Daraja class</h3></div>
        {accessToken && <span className="module-badge sage">Verified attendance</span>}
      </div>
      {!accessToken ? (
        <div className="feature-card live-sign-in-card">
          <p className="muted">Live Jitsi sessions require signing in with a Daraja student account so your online attendance can be verified.</p>
          <button type="button" onClick={onSignIn}>Sign in to join live training</button>
        </div>
      ) : (
        <>
          <form className="live-room-form" onSubmit={joinRoom}>
            <label>Available live sessions
              <select value={selectedRoom?.id ?? ''} onChange={(event) => {
                const room = rooms.find((item) => item.id === event.target.value) ?? null;
                setSelectedRoom(room);
                if (room) setRoomCode(room.room_key);
              }}>
                <option value="">Choose a session</option>
                {rooms.map((room) => <option key={room.id} value={room.id}>{room.title} · {room.status}</option>)}
              </select>
            </label>
            <span className="live-room-or">or</span>
            <label>Facilitator room code<input value={roomCode} minLength={3} maxLength={80} placeholder="e.g. daraja-week-3" onChange={(event) => { setRoomCode(event.target.value); setSelectedRoom(null); }} /></label>
            <button type="submit" disabled={busy}>{busy ? 'Preparing…' : 'Join live session'}</button>
          </form>
          {status && <p className="muted" role="status">{status}</p>}
          {!rooms.length && <p className="muted small">No scheduled room is active yet. You can still enter a room code from your facilitator.</p>}
          {meeting && <JitsiConference accessToken={accessToken} roomName={meeting.roomName} roomTitle={selectedRoom?.title ?? meeting.roomName} meetingId={meeting.meetingId} sessionId={meeting.sessionId} token={meeting.token} requiresJitsiJwt={meeting.requiresJitsiJwt} user={{ id: meeting.user?.id ?? user?.id ?? '', name: meeting.user?.name ?? user?.name ?? 'Daraja student', email: meeting.user?.email ?? user?.email ?? '' }} isModerator={meeting.user?.isModerator} jitsiDomain={meeting.jitsiDomain} />}
        </>
      )}
    </section>
  );
}
