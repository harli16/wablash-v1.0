// src/pages/LogsPage.jsx
import { useEffect, useState } from 'react';
import { getMessageLogs } from '../api';

// helper badge untuk status log backend ('success' | 'failed' | 'invalid')
function logBadge(status) {
  switch ((status || '').toLowerCase()) {
    case 'success': return '✅ Terkirim';
    case 'invalid': return '🚫 Bukan nomor WA';
    case 'failed':  return '❌ Gagal';
    default:        return status || '-';
  }
}

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr('');
      try {
        // bebasin limit sesuai kebutuhan
        const data = await getMessageLogs(200);
        // backend bisa balikin { ok, items: [...] } atau array langsung
        setLogs(Array.isArray(data) ? data : (data?.items || []));
      } catch (e) {
        setErr(e?.message || 'Gagal memuat log');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Log Pengiriman</h2>

      {loading && <div>Memuat...</div>}
      {err && <div style={{ color: 'red' }}>Error: {err}</div>}

      {!loading && !err && (
        <table border="1" cellPadding="4" style={{ marginTop: 10, width: '100%' }}>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Nomor</th>
              <th>Pesan</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>Belum ada log.</td></tr>
            )}
            {logs.map((l, i) => (
              <tr key={l._id || i}>
                <td>{l.createdAt ? new Date(l.createdAt).toLocaleString() : '-'}</td>
                <td>{l.number}</td>
                <td>{l.message}</td>
                <td>{logBadge(l.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
