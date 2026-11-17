import { handleLinkClick, navigate, parseStudentRoute, usePathname } from '../router';
import GuideReader from './GuideReader';
import MentalHealthHub from './MentalHealthHub';
import ReachOut from './ReachOut';

const studentNav: Array<{ key: 'overview' | 'hub' | 'reach-out'; label: string; path: string }> = [
  { key: 'overview', label: 'Overview', path: '/student' },
  { key: 'hub', label: 'Mental health hub', path: '/student/hub' },
  { key: 'reach-out', label: 'Reach out', path: '/student/reach-out' },
];

/** The public learning space. It has no staff navigation and needs no sign-in. */
export default function StudentPortal() {
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
          </section>
        )}
        {route?.kind === 'hub' && <MentalHealthHub />}
        {route?.kind === 'guide' && <GuideReader slug={route.slug} />}
        {route?.kind === 'reach-out' && <ReachOut />}
      </section>
    </main>
  );
}
