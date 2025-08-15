// src/components/ConnectionBar.jsx
import { useEffect, useState } from 'react';
import { waStatus, waQR, resetSession } from '../api';

export default function ConnectionBar() {
  const [connected, setConnected] = useState(null); // null | true | false
  const [checking, setChecking] = useState(false);
  const [qr, setQr] = useState('');
  const [loadingQr, setLoadingQr] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Normalisasi berbagai format response status backend
  function normalizeConnected(s) {
    // 1) Bentuk lama: { connected: boolean }
    if (typeof s?.connected === 'boolean') return s.connected;

    // 2) Bentuk kamu: { ok, state: "CONNECTED", ready: true }
    if (s && typeof s === 'object') {
      const state = String(s.state || '').toUpperCase();
      const ready = Boolean(s.ready);
      if (state) {
        // Anggap connected bila state mengandung CONNECT / OPEN dan ready = true
        if ((/CONNECT|OPEN/.test(state)) && (s.ready === undefined || ready)) return true;
        // Jelas tidak terhubung jika DISCONNECT, PAIRING, QR, TIMEOUT, CONFLICT, dll.
        if (/DISCONNECT|PAIR|QR|TIMEOUT|CONFLICT|UNPAIRED/i.test(state)) return false;
      }
      // fallback: kalau ok true & ready true, anggap connected
      if (s.ok === true && ready === true) return true;
    }

    // Tidak bisa ditentukan
    return null;
  }

  // cek status sekali saat mount
  useEffect(() => {
    (async () => {
      try {
        setChecking(true);
        const s = await waStatus();
        setConnected(normalizeConnected(s));
      } catch {
        setConnected(null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleShowQr = async () => {
    setLoadingQr(true);
    try {
      const { qr } = await waQR(); // { qr: "<base64>" atau "data:image/png;base64,..."}
      setQr(qr?.startsWith('data:') ? qr : `data:image/png;base64,${qr}`);
      setConnected(false); // menampilkan QR → anggap belum terhubung
    } catch (e) {
      alert(e?.message || 'Gagal ambil QR');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset session? Nanti harus scan QR lagi.')) return;
    setResetting(true);
    try {
      await resetSession();
      setQr('');
      setConnected(false);
      alert('Session direset. Silakan ambil QR lalu scan ulang.');
    } catch (e) {
      alert(e?.message || 'Gagal reset session');
    } finally {
      setResetting(false);
    }
  };

  const badge = checking
    ? 'Memeriksa...'
    : connected === true
      ? '🟢 Terhubung'
      : connected === false
        ? '🟡 Perlu scan QR'
        : 'ℹ️ Status tidak diketahui';

  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'center',
      background: '#f3f4f6', padding: 10, borderRadius: 8, marginBottom: 12
    }}>
      <strong>WhatsApp:</strong>
      <span>{badge}</span>

      <button onClick={handleShowQr} disabled={loadingQr} style={{ marginLeft: 'auto' }}>
        {loadingQr ? 'Mengambil QR...' : 'Tampilkan QR'}
      </button>
      <button onClick={handleReset} disabled={resetting}>
        {resetting ? 'Mereset...' : 'Reset Session'}
      </button>

      {qr && (
        <div style={{ marginLeft: 10 }}>
          <div style={{ fontSize: 12, color: '#555' }}>Scan QR ini di WhatsApp</div>
          <img src={qr} alt="QR WhatsApp" style={{ height: 160, border: '1px solid #ddd' }} />
        </div>
      )}
    </div>
  );
}
