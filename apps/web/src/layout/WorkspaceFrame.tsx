import type { ReactNode } from 'react';

import { handleLinkClick, navigate } from '../router';
import type { AppUser } from '../roles';
import { roleLabel } from '../roles';
import './workspace.css';

export type WorkspaceNavItem = { key: string; label: string; path: string };

type WorkspaceFrameProps = {
  area: 'admin' | 'facilitator';
  /** Name of the dashboard, e.g. "Admin dashboard". */
  workspaceName: string;
  nav: WorkspaceNavItem[];
  activeKey: string;
  user: AppUser | null;
  status: string;
  kicker: string;
  heading: string;
  badge: string;
  badgeTone: 'indigo' | 'sage';
  onSwitchRole: () => void;
  onOpenStudentPortal: () => void;
  onSignOut?: () => void;
  children: ReactNode;
};

/**
 * The staff shell shared by the admin and facilitator dashboards: brand, the
 * dashboard's own navigation, the signed-in account and the page header. Each
 * dashboard passes only the screens that belong to it, so a facilitator never
 * sees an admin destination in the navigation.
 */
export default function WorkspaceFrame({
  area,
  workspaceName,
  nav,
  activeKey,
  user,
  status,
  kicker,
  heading,
  badge,
  badgeTone,
  onSwitchRole,
  onOpenStudentPortal,
  onSignOut,
  children,
}: WorkspaceFrameProps) {
  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-wrap">
          <img className="brand-badge" src="/daraja-logo.png" alt="" />
          <div>
            <p className="eyebrow">Daraja Netizens</p>
            <h1>{workspaceName}</h1>
          </div>
        </div>

        <div className={`workspace-title ${area}`} aria-label="Signed-in workspace">
          {area === 'admin' ? 'Administrator access' : 'Facilitator access'}
        </div>

        <div className="user-card">
          <span className="avatar">{(user?.name ?? 'D').slice(0, 1)}</span>
          <div>
            <strong>{user?.name ?? (area === 'admin' ? 'Administrator' : 'Facilitator')}</strong>
            <span className="workspace-role">{roleLabel(user?.role)}</span>
          </div>
        </div>

        <nav className="side-nav workspace-nav" aria-label={`${workspaceName} navigation`}>
          {nav.map((item) => (
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
          <button type="button" className="ghost-button" onClick={onOpenStudentPortal}>Student portal</button>
          <button type="button" className="ghost-button" onClick={onSwitchRole}>Switch role</button>
        </div>

        <div className="status-box">
          <span className="status-label">System status</span>
          <strong>{status}</strong>
        </div>
      </aside>

      <section className="content-panel">
        <header className="content-header">
          <div>
            <p className="viewer-kicker">{kicker}</p>
            <h2>{heading}</h2>
          </div>
          <div className="header-actions">
            <span className={badgeTone === 'indigo' ? 'module-badge indigo' : 'module-badge sage'}>{badge}</span>
            <span className="live-indicator"><i />Secure session</span>
            <button type="button" className="pill-button" onClick={() => navigate(area === 'admin' ? '/admin' : '/facilitator')}>
              Refresh view
            </button>
            {onSignOut && <button type="button" className="pill-button" onClick={onSignOut}>Sign out</button>}
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
