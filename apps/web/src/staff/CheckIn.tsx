import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import { apiFetch } from '../api';

type Session = { id: string; title: string; scheduled_at: string; session_type: string; status: string };

type Challenge = { token: string; expires_at: string };

/**
 * One-time QR check-in for a training session. Used from both dashboards: the
 * facilitator displays it while the session runs; an admin can use it too.
 */
export default function CheckIn({ accessToken }: { accessToken: string | null }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch('/api/v1/sessions', accessToken)
      .then((data: { sessions: Session[] }) => {
        setSessions(data.sessions);
        const firstOpen = data.sessions.find((session) => session.status !== 'completed' && session.status !== 'cancelled');
        setSessionId(firstOpen?.id ?? data.sessions[0]?.id ?? '');
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Sessions are unavailable'));
  }, [accessToken]);

  useEffect(() => {
    if (!challenge) {
      setQrImage('');
      return;
    }
    let active = true;
    QRCode.toDataURL(challenge.token, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then((dataUrl: string) => {
        if (active) setQrImage(dataUrl);
      })
      .catch(() => {
        if (active) setQrImage('');
      });
    return () => {
      active = false;
    };
  }, [challenge]);

  async function generate() {
    if (!sessionId) {
      setMessage('Choose a training session first.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const data = await apiFetch('/api/v1/attendance/qr', accessToken, {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      });
      setChallenge({ token: data.token, expires_at: data.expires_at });
      setMessage('Challenge created — it expires in sixty seconds and can only be redeemed once.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create a check-in');
    } finally {
      setBusy(false);
    }
  }

  const selected = sessions.find((session) => session.id === sessionId);

  return (
    <section className="feature-grid">
      <div className="feature-card">
        <p className="viewer-kicker">Physical attendance</p>
        <h3>Generate a one-time check-in</h3>
        <p className="muted">
          Pick the session running now, then show this challenge on the facilitator screen. Each code expires after
          sixty seconds and can only be redeemed once.
        </p>
        <label>
          Training session
          <select value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
            <option value="">Choose a session</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title} · {formatSession(session)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void generate()} disabled={busy || !sessionId}>
          {busy ? 'Generating…' : 'Generate QR challenge'}
        </button>
        {message && <p className={message.startsWith('Challenge created') ? 'muted' : 'error-text'}>{message}</p>}
      </div>

      <div className="qr-card">
        {qrImage && challenge ? (
          <>
            <img src={qrImage} alt="Attendance QR code" className="qr-image" />
            <code>{challenge.token}</code>
            <span className="muted">
              {selected ? `${selected.title} · valid until ${formatSessionTime(challenge.expires_at)}` : `Valid until ${formatSessionTime(challenge.expires_at)}`}
            </span>
          </>
        ) : (
          <span className="muted">Your active QR challenge will appear here.</span>
        )}
      </div>
    </section>
  );
}

function formatSession(session: Session) {
  return new Date(session.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function formatSessionTime(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
}
