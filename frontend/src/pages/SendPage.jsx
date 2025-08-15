// src/pages/SendPage.jsx
import { useMemo, useState, useEffect } from 'react';
import { sendMessage } from '../api';
import { statusLabel } from '../utils/statusLabel';
import ConnectionBar from '../components/ConnectionBar';
import ImportContacts from '../components/ImportContacts';
import { normalizeNumber } from '../utils/normalizeNumber';
import { renderTemplate } from '../utils/renderTemplate';
import MessageEditor from '../components/MessageEditor';
import { analyzeCaption, spinSynonyms, withJitter } from '../utils/antiSpam';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default function SendPage() {
  const [numbers, setNumbers] = useState('');
  const [contacts, setContacts] = useState([]); // [{ number, fullname, asal_sekolah, ... }]
  const [message, setMessage] = useState(() => localStorage.getItem('blast_message') || '');
  const [delayMs, setDelayMs] = useState(5000);
  const [limitPerMin, setLimitPerMin] = useState(0);
  const [sending, setSending] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [results, setResults] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Dummy template pesan (bisa diganti API call)
  const templates = [
    { id: 1, name: "Sapa Siswa Baru", text: "Halo [fullname], selamat bergabung di sekolah kami!" },
    { id: 2, name: "Pengumuman Event", text: "Halo [fullname], jangan lupa hadir di acara [event] pada [tanggal]." },
    { id: 3, name: "Reminder Pembayaran", text: "Halo [fullname], mohon melakukan pembayaran sebelum [tanggal]." }
  ];

  useEffect(() => {
    localStorage.setItem('blast_message', message);
  }, [message]);

  const listRows = useMemo(() => {
    if (contacts.length > 0) return contacts;
    const nums = Array.from(new Set(
      numbers.split(/\s|,|;/).map(s => normalizeNumber(s)).filter(Boolean)
    ));
    return nums.map(n => ({ number: n }));
  }, [contacts, numbers]);

  const total = listRows.length;
  const sentCount = results.filter(r => r.status === 'done').length;
  const progressPct = total ? Math.floor((sentCount / total) * 100) : 0;

  const fields = contacts.length
    ? Object.keys(contacts[0]).filter(k => k.toLowerCase() !== 'number')
    : [];

  const buildInitialResults = () => {
    return listRows.map((row, i) => {
      const rendered = renderTemplate(message, row);
      return {
        idx: i,
        number: row.number,
        name: row.fullname || row.name || '',
        school: row.asal_sekolah || row.asalSekolah || row.sekolah || '',
        rendered,
        status: 'pending',
        response: null,
      };
    });
  };

  const sentTimestamps = [];
  async function enforceRateLimiter(limit) {
    if (!limit || limit <= 0) return;
    const now = Date.now();
    while (sentTimestamps.length && now - sentTimestamps[0] > 60_000) sentTimestamps.shift();
    if (sentTimestamps.length >= limit) {
      const wait = 60_000 - (now - sentTimestamps[0]);
      if (wait > 0) await sleep(wait);
    }
  }

  const handleSend = async () => {
    if (total === 0 || !message.trim()) return;

    const initial = buildInitialResults();
    setResults(initial);
    setSending(true);
    setCurrentIdx(-1);

    for (let i = 0; i < initial.length; i++) {
      const row = initial[i];

      setCurrentIdx(i);
      setResults(prev => prev.map(r => r.idx === i ? { ...r, status: 'sending' } : r));

      await enforceRateLimiter(Number(limitPerMin));

      const resp = await sendMessage(row.number, row.rendered);

      setResults(prev => prev.map(r => r.idx === i ? ({ ...r, status: 'done', response: resp }) : r));
      sentTimestamps.push(Date.now());

      const d = Number(delayMs) || 0;
      if (i < initial.length - 1 && d > 0) await sleep(d);
    }

    setCurrentIdx(-1);
    setSending(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>WhatsApp Blast</h2>
      <ConnectionBar />

      <ImportContacts onImported={(rows) => {
        setContacts(rows);
        const merged = Array.from(new Set(rows.map(r => r.number))).join('\n');
        setNumbers(merged);
      }} />

      {fields.length > 0 && (
        <div style={{ fontSize: 12, margin: '6px 0', color: '#374151' }}>
          Placeholder: {fields.map(f => `[${f}]`).join(', ')}
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        background: '#f3f4f6', padding: 10, borderRadius: 8, margin: '8px 0'
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 14 }}>
          Jeda antar pesan (ms)
          <input type="number" min={0} step={100}
                 value={delayMs} onChange={e => setDelayMs(e.target.value)}
                 placeholder="mis. 5000 = 5 detik" style={{ padding: 6, marginTop: 4 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 14 }}>
          Limit per menit (0 = off)
          <input type="number" min={0} step={1}
                 value={limitPerMin} onChange={e => setLimitPerMin(e.target.value)}
                 placeholder="mis. 20 = 20 pesan/menit" style={{ padding: 6, marginTop: 4 }} />
        </label>
      </div>

      {/* Tombol Pilih Template */}
      <button
        type="button"
        onClick={() => setShowTemplateModal(true)}
        disabled={sending}
        style={{ marginBottom: 10 }}
      >
        Pilih Template Pesan
      </button>

      {/* Editor pesan */}
      <MessageEditor
        value={message}
        onChange={setMessage}
        fields={fields}
        disabled={sending}
      />

      <br />
      <button onClick={handleSend} disabled={sending || total === 0 || !message.trim()}>
        {sending ? 'Mengirim...' : `Kirim (${total})`}
      </button>

      {(sending || currentIdx >= 0) && (
        <div style={{ marginTop: 10, fontSize: 14 }}>
          {currentIdx >= 0 ? (
            <>
              Sedang mengirim ke <b>{results[currentIdx]?.name || results[currentIdx]?.number}</b>
              {results[currentIdx]?.school ? ` — ${results[currentIdx].school}` : ''} ({currentIdx + 1}/{total})
            </>
          ) : 'Menyiapkan pengiriman...'}
          <div style={{ height: 10, background: '#e5e7eb', borderRadius: 999, marginTop: 6 }}>
            <div style={{
              width: `${progressPct}%`,
              height: '100%',
              background: '#60a5fa',
              borderRadius: 999,
              transition: 'width 200ms linear'
            }} />
          </div>
        </div>
      )}

      {results.length > 0 && (
        <table border="1" cellPadding="4" style={{ marginTop: 16, width: '100%', fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ width: 42 }}>No</th>
              <th>Nomor</th>
              <th>Nama</th>
              <th>Asal Sekolah</th>
              <th style={{ width: 180 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, idx) => (
              <tr key={`${r.number}-${idx}`} style={{ background: r.status === 'sending' ? '#fff7ed' : 'transparent' }}>
                <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                <td>{r.number}</td>
                <td>{r.name || '-'}</td>
                <td>{r.school || '-'}</td>
                <td>
                  {r.status === 'pending'  && '⏳ Menunggu giliran'}
                  {r.status === 'sending'  && '📤 Mengirim...'}
                  {r.status === 'done'     && statusLabel(r.response)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal Pilih Template */}
      {showTemplateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            background: '#fff', padding: 20, borderRadius: 8, width: '400px',
            maxHeight: '80%', overflowY: 'auto'
          }}>
            <h3>Pilih Template</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {templates.map(t => (
                <li key={t.id} style={{
                  border: '1px solid #ddd', borderRadius: 6, padding: 10, margin: '8px 0',
                  cursor: 'pointer', background: '#f9fafb'
                }}
                  onClick={() => {
                    setMessage(t.text);
                    setShowTemplateModal(false);
                  }}
                >
                  <strong>{t.name}</strong>
                  <div style={{ fontSize: 12, color: '#555' }}>{t.text}</div>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowTemplateModal(false)}>Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
