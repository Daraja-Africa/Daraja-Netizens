import { useEffect, useState, type MouseEvent } from 'react';

export type StudentRoute =
  | { kind: 'overview' | 'hub' | 'reach-out' }
  | { kind: 'guide'; slug: string };

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

export type FacilitatorRoute = { kind: 'flashcards' } | { kind: 'data' };

const facilitatorPrefix = '/facilitator';

export function parseFacilitatorRoute(pathname: string): FacilitatorRoute | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === `${facilitatorPrefix}/flashcards`) return { kind: 'flashcards' };
  if (clean === `${facilitatorPrefix}/data`) return { kind: 'data' };
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
