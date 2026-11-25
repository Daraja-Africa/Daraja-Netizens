import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { checkFirstLoginStatus, setupFirstLoginPassword } from '../api';

type CredentialSignInProps = {
  client: SupabaseClient;
  heading?: string;
  description?: string;
  accessNotice?: string;
  onGoogle?: () => Promise<string | undefined>;
  onDiscord?: () => Promise<string | undefined>;
  onBack?: () => void;
  backLabel?: string;
};

export default function CredentialSignIn({
  client,
  heading = 'Sign in',
  description = 'Use your Daraja email and password to continue.',
  accessNotice = '',
  onGoogle,
  onDiscord,
  onBack,
  backLabel = 'Back',
}: CredentialSignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ fullName: string; email: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function checkFirstLogin() {
    setError('');
    if (!email) return setError('Enter your email address first.');
    setBusy(true);
    try {
      const status = await checkFirstLoginStatus(email);
      if (status.status === 'needs_password') {
        setNewPassword(password.length >= 8 ? password : '');
        setConfirmPassword('');
        setSetup({ fullName: status.fullName || email, email: email.trim().toLowerCase() });
      } else if (status.status === 'not_allowlisted') {
        setError('This email address is not registered on the Daraja allowlist.');
      } else {
        setError('Incorrect email or password. Please try again.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not check this email right now.');
    } finally {
      setBusy(false);
    }
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (!result.error) return;
      await checkFirstLogin();
    } finally {
      setBusy(false);
    }
  }

  async function signInWith(provider: (() => Promise<string | undefined>) | undefined) {
    if (!provider) return;
    setError('');
    setBusy(true);
    try {
      const providerError = await provider();
      if (providerError) setError(providerError);
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (!setup) return;
    if (newPassword.length < 8) return setError('Your new password must be at least 8 characters.');
    if (newPassword !== confirmPassword) return setError('The passwords do not match.');
    setError('');
    setBusy(true);
    try {
      await setupFirstLoginPassword(setup.email, newPassword);
      const result = await client.auth.signInWithPassword({ email: setup.email, password: newPassword });
      if (result.error) throw result.error;
      setSetup(null);
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'We could not save your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={signIn}>
        <img className="brand-badge" src="/daraja-logo.png" alt="" />
        <p className="eyebrow">Daraja Netizens</p>
        <h1>{heading}</h1>
        <p className="muted">{description}</p>
        {accessNotice && <p className="notice-banner" role="alert">{accessNotice}</p>}
        {onGoogle && <button type="button" className="google-button" disabled={busy} onClick={() => void signInWith(onGoogle)}>Sign in with Google</button>}
        {onDiscord && <button type="button" className="discord-button" disabled={busy} onClick={() => void signInWith(onDiscord)}>Sign in with Discord</button>}
        {(onGoogle || onDiscord) && <p className="auth-divider">Or use your Daraja email</p>}
        <label>Email<input type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password<input type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="auth-secondary-action" disabled={busy} onClick={() => void checkFirstLogin()}>
          First time signing in? Set up your password
        </button>
        {onBack && <button type="button" className="ghost-button" onClick={onBack}>{backLabel}</button>}
      </form>
      {setup && (
        <div className="auth-modal-backdrop" role="presentation">
          <form className="auth-card auth-modal" role="dialog" aria-modal="true" aria-labelledby="password-setup-title" onSubmit={savePassword}>
            <p className="eyebrow">First-time access</p>
            <h2 id="password-setup-title">Create Your Password</h2>
            <p className="muted">Set a password for {setup.fullName} ({setup.email}).</p>
            <label>New Password<input type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
            <label>Confirm Password<input type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
            {error && <p className="error-text" role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save Password & Sign In'}</button>
            <button type="button" className="ghost-button" disabled={busy} onClick={() => setSetup(null)}>Cancel</button>
          </form>
        </div>
      )}
    </main>
  );
}
