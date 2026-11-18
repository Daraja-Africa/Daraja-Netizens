import { handleLinkClick } from '../router';

/**
 * Legal links for every public surface. Discord's app review opens /terms and
 * /privacy without signing in, so they must be reachable from the role gate too.
 */
export default function AppFooter() {
  return (
    <footer className="app-footer">
      <span>© {new Date().getFullYear()} Daraja Netizens</span>
      <nav aria-label="Legal">
        <a href="/terms" onClick={(event) => handleLinkClick(event, '/terms')}>Terms of Service</a>
        <a href="/privacy" onClick={(event) => handleLinkClick(event, '/privacy')}>Privacy Policy</a>
      </nav>
    </footer>
  );
}
