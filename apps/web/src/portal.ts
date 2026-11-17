export type Portal = 'student' | 'facilitator';

const PORTAL_STORAGE_KEY = 'daraja.portal';

export function readStoredPortal(): Portal | null {
  try {
    const stored = window.sessionStorage.getItem(PORTAL_STORAGE_KEY);
    return stored === 'student' || stored === 'facilitator' ? stored : null;
  } catch {
    return null;
  }
}

export function storePortal(portal: Portal | null) {
  try {
    if (portal) window.sessionStorage.setItem(PORTAL_STORAGE_KEY, portal);
    else window.sessionStorage.removeItem(PORTAL_STORAGE_KEY);
  } catch {
    // Private browsing can block storage; the in-memory selection still works.
  }
}
