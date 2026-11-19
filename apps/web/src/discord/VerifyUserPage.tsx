import { useEffect, useRef, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { ApiError, apiFetch } from '../api';
import AppFooter from '../layout/AppFooter';
import { handleLinkClick } from '../router';
import { detectOAuthWebView } from '../authEnvironment';

/** Exactly the scopes the role-connection write needs, and nothing more. */
const discordScopes = 'identify email role_connections.write';

type Verification =
  | { state: 'signed-out' }
  | { state: 'linking' }
  | { state: 'verified'; role: string }
  | { state: 'failed'; message: string };

/**
 * Discord's Linked Roles verification URL (/discord/verify-user).
 *
 * Public by design: a Discord member or an app reviewer opens it without a
 * session. "Verify with Discord" runs Supabase's Discord OAuth, and when the
 * redirect comes back with a session and its provider credential the page asks
 * the API to write the facilitator badge to that Discord account.
 */
export default function VerifyUserPage({
  client,
  session,
}: {
  client: SupabaseClient | null;
  session: Session | null;
}) {
  const [verification, setVerification] = useState<Verification>({ state: 'signed-out' });
  const [isStarting, setIsStarting] = useState(false);
  const providerCredential = session?.provider_token ?? null;
  const accessToken = session?.access_token ?? null;
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!providerCredential || !accessToken) return;
    if (attempted.current === providerCredential) return;
    attempted.current = providerCredential;
    setVerification({ state: 'linking' });

    void apiFetch('/api/v1/discord/linked-roles', accessToken, {
      method: 'POST',
      body: JSON.stringify({ providerToken: providerCredential }),
    })
      .then((data: { verified?: boolean; role?: string }) => {
        if (data?.verified) {
          setVerification({ state: 'verified', role: data.role ?? 'facilitator' });
          return;
        }
        setVerification({ state: 'failed', message: 'Discord did not confirm the role connection. Please try again.' });
      })
      .catch((error: unknown) => setVerification({ state: 'failed', message: describeFailure(error) }));
  }, [accessToken, providerCredential]);

  async function verifyWithDiscord() {
    if (!client) return;
    setVerification({ state: 'signed-out' });
    const webView = detectOAuthWebView(navigator.userAgent);
    if (webView.embedded) {
      setVerification({ state: 'failed', message: webView.instruction });
      return;
    }
    setIsStarting(true);
    const result = await client.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        scopes: discordScopes,
        redirectTo: `${window.location.origin}/discord/verify-user`,
      },
    });
    if (result.error) {
      setVerification({ state: 'failed', message: result.error.message });
      setIsStarting(false);
    }
  }

  const badge = statusBadge(verification);

  return (
    <main className="legal-shell">
      <div className="legal-inner">
        <header className="legal-header">
          <img className="brand-badge" src="/daraja-logo.png" alt="" />
          <div>
            <p className="eyebrow">Daraja Netizens</p>
            <h1>Linked role verification</h1>
            <p className="legal-meta">Discord facilitator badge</p>
          </div>
        </header>

        <section className="legal-card verify-card">
          <p className="verify-lead">
            Confirm your Daraja facilitator status and we will write a <strong>Verified facilitator</strong> badge to
            your Discord account. We share only that you are on the Daraja roster &mdash; never your email, your training
            records or your reach-out history.
          </p>
          <ol className="verify-steps">
            <li>Sign in with the Discord account you use in the Daraja community.</li>
            <li>We check your email against the Daraja facilitator and admin roster.</li>
            <li>Discord shows the Daraja facilitator badge on your profile and unlocks the server role.</li>
          </ol>

          <div className="verify-state" role="status" aria-live="polite">
            <span className={`verify-pill ${badge.tone}`}>{badge.label}</span>
            <div>
              <p className="verify-state-title">{badge.title}</p>
              <p className="verify-state-detail">{badge.detail}</p>
            </div>
          </div>

          <div className="verify-actions">
            {verification.state === 'verified' ? (
              <a className="verify-button" href="/" onClick={(event) => handleLinkClick(event, '/')}>
                Back to the portal
              </a>
            ) : (
              <button
                type="button"
                className="verify-button"
                onClick={() => void verifyWithDiscord()}
                disabled={!client || isStarting || verification.state === 'linking'}
              >
                {verification.state === 'linking'
                  ? 'Verifying with Discord…'
                  : providerCredential
                    ? 'Link the badge again'
                    : 'Verify with Discord'}
              </button>
            )}
            {!client && <p className="verify-hint">Discord sign-in is unavailable in this local demo.</p>}
            {session?.user.email && verification.state !== 'verified' && (
              <p className="verify-hint">Signed in as {session.user.email}</p>
            )}
          </div>
        </section>

        <nav className="legal-nav" aria-label="Legal documents">
          <a href="/" onClick={(event) => handleLinkClick(event, '/')}>← Back to the portal</a>
          <a href="/privacy" onClick={(event) => handleLinkClick(event, '/privacy')}>Privacy Policy</a>
        </nav>

        <AppFooter />
      </div>
    </main>
  );
}

function statusBadge(verification: Verification) {
  switch (verification.state) {
    case 'linking':
      return {
        label: 'Checking',
        tone: 'is-pending',
        title: 'Verifying your Daraja role',
        detail: 'Hold on while we confirm your roster entry and write the badge to Discord.',
      };
    case 'verified':
      return {
        label: 'Verified',
        tone: 'is-verified',
        title: `Verified Daraja ${verification.role}`,
        detail: 'Your Discord account is linked. The facilitator badge and server role are now active.',
      };
    case 'failed':
      return {
        label: 'Not registered',
        tone: 'is-error',
        title: 'This account could not be verified',
        detail: verification.message,
      };
    default:
      return {
        label: 'Not registered',
        tone: 'is-pending',
        title: 'This Discord account is not linked yet',
        detail: 'Sign in with Discord using your Daraja facilitator email to link the badge.',
      };
  }
}

function describeFailure(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return error.payload?.error === 'NOT_ALLOWLISTED'
        ? 'This account is not on the Daraja facilitator roster. Ask a Daraja admin to add your email, then try again.'
        : 'Only approved Daraja facilitators and admins can link this badge.';
    }
    if (error.status === 503) return 'Discord role verification is not configured on the server yet.';
    if (error.status === 502) return 'Discord did not answer. Please try again in a moment.';
    return error.message;
  }
  return 'We could not reach the Daraja API. Check your connection and try again.';
}
