import { useEffect, useState, type MouseEvent } from 'react';

export type StudentRoute =
  | { kind: 'overview' | 'hub' | 'reach-out' }
  | { kind: 'guide'; slug: string };

export type AdminPage =
  | 'overview'
  | 'members'
  | 'facilitators'
  | 'program'
  | 'attendance'
  | 'data'
  | 'check-in'
  | 'scanner'
  | 'training';

export type FacilitatorPage = 'overview' | 'meetings' | 'check-in' | 'scanner' | 'training' | 'flashcards';

export type WorkspaceArea = 'admin' | 'facilitator';

export type WorkspaceRoute =
  | { area: 'admin'; page: AdminPage }
  | { area: 'facilitator'; page: FacilitatorPage };

const prefix = '/student';

export function parseStudentRoute(pathname: string): StudentRoute | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean !== prefix && !clean.startsWith(`${prefix}/`)) return null;
  if (clean === `${prefix}/hub`) return { kind: 'hub' };
  if (clean.startsWith(`${prefix}/hub/`)) {
    const slug = decodeURIComponent(clean.slice(`${prefix}/hub/`.length));
    if (slug) return { kind: 'guide', slug };
  }
  if (clean === `${prefix}/reach-out`) return { kind: 'reach-out' };
  return { kind: 'overview' };
}

const adminPages: Record<string, AdminPage> = {
  '': 'overview',
  members: 'members',
  facilitators: 'facilitators',
  program: 'program',
  attendance: 'attendance',
  data: 'data',
  'check-in': 'check-in',
  scanner: 'scanner',
  training: 'training',
};

const facilitatorPages: Record<string, FacilitatorPage> = {
  '': 'overview',
  meetings: 'meetings',
  'check-in': 'check-in',
  scanner: 'scanner',
  training: 'training',
  flashcards: 'flashcards',
};

export function parseWorkspaceRoute(pathname: string): WorkspaceRoute | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/admin') return { area: 'admin', page: 'overview' };
  if (clean.startsWith('/admin/')) {
    const page = adminPages[clean.slice('/admin/'.length)];
    return { area: 'admin', page: page ?? 'overview' };
  }
  if (clean === '/facilitator') return { area: 'facilitator', page: 'overview' };
  if (clean.startsWith('/facilitator/')) {
    const page = facilitatorPages[clean.slice('/facilitator/'.length)];
    return { area: 'facilitator', page: page ?? 'overview' };
  }
  return null;
}

export type FacilitatorRoute = { kind: 'flashcards' } | { kind: 'data' } | { kind: 'reach-out' };

const facilitatorPrefix = '/facilitator';

export function parseFacilitatorRoute(pathname: string): FacilitatorRoute | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === `${facilitatorPrefix}/flashcards`) return { kind: 'flashcards' };
  if (clean === `${facilitatorPrefix}/data`) return { kind: 'data' };
  if (clean === `${facilitatorPrefix}/reach-out`) return { kind: 'reach-out' };
  return null;
}

export type LegalPage = 'terms' | 'privacy';

/** Public pages Discord's app review can open without signing in. */
export function parseLegalRoute(pathname: string): LegalPage | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/terms') return 'terms';
  if (clean === '/privacy') return 'privacy';
  return null;
}

export function navigate(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    const onChange = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return pathname;
}

/** Keeps real links (open in new tab, copy address) while routing in-app. */
export function handleLinkClick(event: MouseEvent<HTMLAnchorElement>, path: string) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(path);
}
