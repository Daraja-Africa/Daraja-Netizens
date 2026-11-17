import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

import { apiFetch } from '../api';

type Challenge = { token: string; expires_at: string; session?: { title: string } };

/**
 * One-time QR check-in for a training session. Used from both dashboards: the
 * facilitator displays it while the session runs; an admin can use it too.
 */
export default function CheckIn({ accessToken }: { accessToken: string | null }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    setMessage('');
    try {
      const data = await apiFetch('/api/v1/attendance/qr', accessToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setChallenge({ token: data.token, expires_at: data.expires_at, session: data.session });
      setMessage('Challenge created — it expires in sixty seconds and can only be redeemed once.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create a check-in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="feature-grid">
      <div className="feature-card">
        <p className="viewer-kicker">Physical attendance</p>
        <h3>Generate a one-time check-in</h3>
        <p className="muted">
          This challenge is issued for today's physical session. Each code expires after sixty seconds and can only be
          redeemed once.
        </p>
        <button type="button" onClick={() => void generate()} disabled={busy}>
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
              {challenge.session ? `${challenge.session.title} · valid until ${formatSessionTime(challenge.expires_at)}` : `Valid until ${formatSessionTime(challenge.expires_at)}`}
            </span>
          </>
        ) : (
          <span className="muted">Your active QR challenge will appear here.</span>
        )}
      </div>
    </section>
  );
}

function formatSessionTime(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
}
