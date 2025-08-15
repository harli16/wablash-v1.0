import { useEffect, useState, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { waStatus, waQR, resetSession } from '../api';

export default function QRPage() {
  const [state, setState] = useState('CHECKING');
  const [qr, setQr] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    try {
      const s = await waStatus();
      setState(s.state);
      if (!s.ready) {
        const q = await waQR().catch(() => null);
        if (q?.qr) setQr(q.qr);
      } else {
        setQr('');
      }
    } catch (e) {
      setMsg('Gagal ambil status. Pastikan sudah login & token valid.');
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const onReset = async () => {
    setLoading(true);
    setMsg('');
    try {
      await resetSession();
      setMsg('Session direset. Minta QR baru…');
      setQr('');
      setTimeout(refresh, 800);
    } catch {
      setMsg('Gagal reset session.');
    } finally {
      setLoading(false);
    }
  };

  const Ready = state === 'CONNECTED' || state === 'READY';

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
      <h2 style={{ marginBottom: 12 }}>Status WhatsApp</h2>
      <div style={{ marginBottom: 8 }}><b>State:</b> {state}</div>

      {Ready ? (
        <div style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>✅ Client is ready</div>
          <div style={{ color: '#6b7280' }}>Sudah terhubung. Kamu bisa kirim pesan.</div>
        </div>
      ) : (
        <div style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 12 }}>
          <div style={{ marginBottom: 12 }}>Scan QR berikut pakai WhatsApp HP kamu.</div>
          {qr ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <QRCodeCanvas value={qr} size={280} />
            </div>
          ) : (
            <div style={{ color: '#6b7280', marginBottom: 12 }}>Menunggu QR…</div>
          )}
          <button
            onClick={onReset}
            disabled={loading}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}
          >
            {loading ? 'Resetting…' : 'Reset Session (QR baru)'}
          </button>
        </div>
      )}

      {msg && <div style={{ marginTop: 12, color: '#374151' }}>{msg}</div>}
    </div>
  );
}
