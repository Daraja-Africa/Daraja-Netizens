import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

import { apiFetch } from '../api';

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

/**
 * Camera (or manual) redemption of a one-time QR challenge. Available to both
 * staff dashboards.
 */
export default function Scanner({ accessToken }: { accessToken: string | null }) {
  const [scanToken, setScanToken] = useState('');
  const [cameraStatus, setCameraStatus] = useState('Camera is off');
  const [message, setMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const html5ScannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    void html5ScannerRef.current?.stop().catch(() => undefined);
  }, []);

  async function startCamera() {
    if (!videoRef.current || !('mediaDevices' in navigator)) {
      setCameraStatus('Camera unavailable; use manual token entry');
      return;
    }
    const detector = (window as typeof window & { BarcodeDetector?: new () => BarcodeDetectorLike }).BarcodeDetector;
    if (!detector) {
      try {
        const scanner = new Html5Qrcode('daraja-qr-reader');
        html5ScannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (token) => {
            setScanToken(token);
            setCameraStatus('QR captured. Submit to record attendance.');
            void scanner.stop().catch(() => undefined);
            html5ScannerRef.current = null;
          },
          () => undefined,
        );
        setCameraStatus('Scanning for a QR challenge…');
        return;
      } catch {
        setCameraStatus('Camera permission was denied or QR scanning is unavailable; use manual token entry');
        return;
      }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      cameraStreamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraStatus('Scanning for a QR challenge…');
      const scanner = new detector();
      const scan = async () => {
        if (!videoRef.current || !cameraStreamRef.current) return;
        const codes = await scanner.detect(videoRef.current);
        const token = codes.find((code) => code.rawValue)?.rawValue;
        if (token) {
          setScanToken(token);
          setCameraStatus('QR captured. Submit to record attendance.');
          cameraStreamRef.current.getTracks().forEach((track) => track.stop());
          cameraStreamRef.current = null;
          return;
        }
        window.setTimeout(() => void scan(), 500);
      };
      void scan();
    } catch {
      setCameraStatus('Camera permission was denied; use manual token entry');
    }
  }

  async function redeem(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      const data = await apiFetch('/api/v1/attendance/qr/redeem', accessToken, { method: 'POST', body: JSON.stringify({ token: scanToken }) });
      setMessage('Attendance recorded successfully.');
      setScanToken('');
      if (data.session_id) window.dispatchEvent(new CustomEvent('daraja-attendance-updated', { detail: { sessionId: data.session_id } }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'QR scan failed');
    }
  }

  return (
    <section className="feature-grid">
      <div className="feature-card">
        <p className="viewer-kicker">Scanner mode</p>
        <h3>Scan a check-in challenge</h3>
        <p className="muted">
          Allow camera access to scan a one-time challenge, or paste the token. Browsers without QR decoding fall back to
          manual entry.
        </p>
        <div className="scanner-frame">
          <video ref={videoRef} className="scanner-video" muted playsInline />
          <div id="daraja-qr-reader" className="scanner-video" />
          <span>{cameraStatus}</span>
        </div>
        <button type="button" onClick={() => void startCamera()}>Start camera scanner</button>
        <form onSubmit={redeem} className="panel-grid">
          <input placeholder="Paste QR token" value={scanToken} onChange={(event) => setScanToken(event.target.value)} required />
          <button type="submit">Record attendance</button>
        </form>
        {message && <p className={message.startsWith('Attendance recorded') ? 'muted' : 'error-text'}>{message}</p>}
      </div>

      <div className="feature-card">
        <h3>Scanner safeguards</h3>
        <ul className="check-list">
          <li>Token expiry is enforced by the API.</li>
          <li>Redeemed tokens cannot be reused.</li>
          <li>Attendance writes are tied to the signed-in account.</li>
          <li>Browsers without BarcodeDetector automatically fall back to manual token entry.</li>
        </ul>
      </div>
    </section>
  );
}
