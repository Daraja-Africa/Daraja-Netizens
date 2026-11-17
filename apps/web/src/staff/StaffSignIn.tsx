import { useState, type FormEvent } from 'react';

type StaffSignInProps = {
  accessNotice: string;
  authError: string;
  busy: boolean;
  onSignIn: (email: string, password: string) => void;
  onGoogle: () => void;
  onBack: () => void;
};

/**
 * Sign-in for both staff dashboards. The account's role decides which dashboard
 * opens afterwards, so this screen never offers a role choice.
 */
export default function StaffSignIn({ accessNotice, authError, busy, onSignIn, onGoogle, onBack }: StaffSignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    onSignIn(email, password);
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <img className="brand-badge" src="/daraja-logo.png" alt="" />
        <p className="eyebrow">Daraja Netizens</p>
        <h1>Staff sign in</h1>
        <p className="muted">
          Administrators open the admin dashboard, facilitators open the facilitator dashboard. Each account only sees
          the workspace its role allows.
        </p>
        {accessNotice && <p className="notice-banner" role="alert">{accessNotice}</p>}
        <button type="button" className="google-button" onClick={onGoogle}>Sign in with Google</button>
        <p className="auth-divider">or use your Daraja email</p>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {authError && <p className="error-text">{authError}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="ghost-button" onClick={onBack}>Back to portals</button>
      </form>
    </main>
  );
}
