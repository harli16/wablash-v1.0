// src/pages/SendMessage.jsx
import {
  Bold, Italic, List, Variable, ChevronDown, Paperclip,
  FileUp, Send as SendIcon, Save, FileText, X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

// ==== pipeline lama (text-only)
import { sendMessage } from '../api';
import ImportContacts from '../components/ImportContacts';
import { normalizeNumber } from '../utils/normalizeNumber';
import { renderTemplate as renderTplUtil } from '../utils/renderTemplate';

// ====== CONFIG & helpers ======
function getToken() {
  try { return localStorage.getItem('token') || ''; } catch { return ''; }
}

// Urutan kandidat base path untuk router messageMedia.js kamu.
// Set REACT_APP_MESSAGE_MEDIA_BASE kalau mau kunci di satu path saja.
const MEDIA_BASES = [
  process.env.REACT_APP_MESSAGE_MEDIA_BASE,                       // e.g. "/api/message"
  (process.env.REACT_APP_API_BASE && `${process.env.REACT_APP_API_BASE}/api/message`),
  '/api/message',                                                 // mount umum
  '/api/message-media',                                           // alternatif
].filter(Boolean);

// fallback kecil agar {{nama}} / [fullname] ikut bekerja
function fallbackRenderTemplate(text, row = {}) {
  if (!text) return text;
  let out = text;
  out = out.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
    const v = row[k] ?? row[k?.toLowerCase()];
    return v != null && String(v).length ? String(v) : `{{${k}}}`;
  });
  out = out.replace(/\[([a-zA-Z0-9_]+)\]/g, (_, k) => {
    const v = row[k] ?? row[k?.toLowerCase()];
    return v != null && String(v).length ? String(v) : `[${k}]`;
  });
  return out;
}
const renderTemplate = (t, r) => {
  try { return renderTplUtil ? renderTplUtil(t, r) : fallbackRenderTemplate(t, r); }
  catch { return fallbackRenderTemplate(t, r); }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// minimal delay agar progress terlihat walau delaySec=0
const ms = (n) => Math.max(300, Number(n) || 0);

function NumberField({ label, value, setValue, min = 0 }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e)=>setValue(Number(e.target.value))}
        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-gray-50 dark:bg-gray-700"
      />
    </div>
  );
}

// // ====== kirim batch media ke BE (sesuai messageMedia.js) + fallback base path + error text-aware
// async function sendMediaBatch(kind, { file, caption, rows, delaySec }) {
//   const fd = new FormData();
//   fd.append('file', file); // field name 'file' (multer.single('file'))
//   fd.append('caption', caption || '');
//   fd.append('rows', JSON.stringify(rows || []));
//   fd.append('delayMs', String((Number(delaySec) || 0) * 1000));

//   const token = getToken();
//   const tried = [];

//   for (const base of MEDIA_BASES) {
//     const url =
//       kind === 'image' ? `${base}/send-image` : `${base}/send-doc`;

//     try {
//       const res = await fetch(url, {
//         method: 'POST',
//         headers: { Authorization: `Bearer ${token}` }, // biarkan Content-Type diatur FormData
//         body: fd,
//       });

//       const text = await res.text(); // baca teks dulu supaya bisa diagnosa ketika HTML
//       let data;
//       try { data = text ? JSON.parse(text) : {}; }
//       catch {
//         // HTML / non-JSON → buat pesan error yang jelas
//         const snippet = text?.slice(0, 120) || '';
//         throw new Error(
//           `Response bukan JSON (status ${res.status}). ` +
//           `Kemungkinan path salah/401/413. Potongan respons: "${snippet}"`
//         );
//       }

//       if (!res.ok || data?.ok === false) {
//         const msg = data?.message || data?.code || `HTTP ${res.status}`;
//         throw new Error(`Server menolak: ${msg}`);
//       }

//       return data; // sukses
//     } catch (e) {
//       tried.push({ base, error: e?.message || String(e) });
//       // coba base berikutnya
//     }
//   }

//   // semua base gagal
//   const lines = tried.map(t => `- ${t.base}: ${t.error}`).join('\n');
//   throw new Error(`Gagal mengirim media. Coba periksa base path router BE.\n${lines}`);
// }

// ====== kirim batch media ke BE (sesuai messageMedia.js) + fallback base path + error text-aware
async function sendMediaBatch(kind, { file, caption, rows, delaySec }) {
  const fd = new FormData();
  fd.append('file', file); // field name 'file' (multer.single('file'))
  fd.append('caption', caption || '');
  fd.append('rows', JSON.stringify(rows || []));
  fd.append('delayMs', String((Number(delaySec) || 0) * 1000));

  const token = getToken();
  const tried = [];

  // ⬅️ PATCH 1: hindari base duplikat biar tidak retry dua kali endpoint yang sama
  const uniqueBases = Array.from(new Set(MEDIA_BASES));

  for (const base of uniqueBases) {
    const url = kind === 'image' ? `${base}/send-image` : `${base}/send-doc`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }, // biarkan Content-Type diatur FormData
        body: fd,
      });

      // baca teks dulu untuk bisa diagnosa HTML/non‑JSON
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        // ⬅️ tetap dianggap transport error → boleh coba base berikutnya
        const snippet = text?.slice(0, 120) || '';
        throw new Error(
          `Response bukan JSON (status ${res.status}). ` +
          `Kemungkinan path salah/401/413. Potongan respons: "${snippet}"`
        );
      }

      // ⬅️ PATCH 2: bedakan "transport error" vs "hasil bisnis"
      // - Kalau HTTP tidak OK → ini transport error → boleh coba base lain
      // - Kalau HTTP OK (200) dan JSON valid, JANGAN lempar error meski data.ok === false,
      //   biar kita tidak retry base lain (menghindari resend & notifikasi merah panjang).
      if (!res.ok) {
        const msg = data?.message || data?.code || JSON.stringify(data) || `HTTP ${res.status}`;
        throw new Error(`Server menolak: ${msg}`);
      }

      // ⬅️ PATCH 3: sukses transport → kembalikan data apa adanya.
      // Penilaian ok/partial akan ditangani di caller.
      return data;
    } catch (e) {
      tried.push({ base, error: e?.message || String(e) });
      // lanjut coba base berikutnya hanya jika ini memang transport error
    }
  }

  // semua base gagal transport (non‑JSON/HTTP bukan 2xx)
  const lines = tried.map(t => `- ${t.base}: ${t.error}`).join('\n');
  throw new Error(`Gagal mengirim media. Coba periksa base path router BE.\n${lines}`);
}


export default function SendMessage() {
  // ===== state utama
  const [message, setMessage] = useState(
    'Camulikum [Fullname], selamat kamu berhasil geyss wkwkk'
  );
  const [contacts, setContacts] = useState([]); // [{ number, fullname, ... }]
  const [attachment, setAttachment] = useState(null); // File
  const attachRef = useRef();

  const [delaySec, setDelaySec] = useState(5);
  const [limitPerMin, setLimitPerMin] = useState(10);

  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [rows, setRows] = useState([]);      // normalized rows yang akan dikirim
  const [results, setResults] = useState([]); // [{idx, number, name, status, response}]

  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  // ===== normalisasi rows dari ImportContacts
  // useEffect(() => {
  //   if (!contacts?.length) { setRows([]); return; }
  //   const uniq = new Map();
  //   contacts.forEach(r => {
  //     const num = normalizeNumber(r.number || r.nomor || r.phone || r.hp || '');
  //     if (!num) return;
  //     const row = { ...r, number: num };
  //     uniq.set(num, { ...uniq.get(num), ...row });
  //   });
  //   const list = Array.from(uniq.values());
  //   setRows(list);
  // }, [contacts]);
    // ===== normalisasi rows dari ImportContacts
  useEffect(() => {
    if (!contacts?.length) { setRows([]); return; }
    const uniq = new Map();
    contacts.forEach(r => {
      const num = normalizeNumber(r.number || r.nomor || r.phone || r.hp || '');
      if (!num) return;
      const row = {
        ...r,
        number: num,
        asalSekolah: r.asalSekolah || '',
        kelas: r.kelas || '',
        tahunLulusan: r.tahunLulusan || '',
        tanggalLahir: r.tanggalLahir || '',
        kodeBeasiswa: r.kodeBeasiswa || ''
      };
      uniq.set(num, { ...uniq.get(num), ...row });
    });
    const list = Array.from(uniq.values());
    setRows(list);
  }, [contacts]);

  // ===== derived
  const total = rows.length;
  const sentCount = results.filter(r => r.status === 'done').length;
  const progressPct = total ? Math.floor((sentCount / total) * 100) : 0;

  // ===== file attachment
  const onChooseAttachment = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 16 * 1024 * 1024) return setErr('Lampiran melebihi 16MB (batas BE).');
    setAttachment(f);
  };
  const removeAttachment = () => {
    setAttachment(null);
    if (attachRef.current) attachRef.current.value = '';
  };

  // ===== limiter (untuk text-only)
  const sentTimestamps = useRef([]);
  async function enforceRateLimiter(limit) {
    if (!limit || limit <= 0) return;
    const now = Date.now();
    while (sentTimestamps.current.length && now - sentTimestamps.current[0] > 60_000) {
      sentTimestamps.current.shift();
    }
    if (sentTimestamps.current.length >= limit) {
      const wait = 60_000 - (now - sentTimestamps.current[0]);
      if (wait > 0) await sleep(wait);
    }
  }

  // ===== kirim
  async function handleSend() {
    setErr(''); setInfo('');
    if (!total) return setErr('Kontak kosong. Upload file kontak dulu.');
    if (!message.trim()) return setErr('Pesan/caption tidak boleh kosong.');

    // // === CABANG MEDIA ===
    // if (attachment) {
    //   setSending(true); setResults([]); setCurrentIdx(-1);
    //   try {
    //     const kind = attachment.type?.startsWith('image/') ? 'image' : 'document';
    //     const res = await sendMediaBatch(kind, {
    //       file: attachment,
    //       caption: message, // caption akan di-template per-row di BE (fillTemplate)
    //       rows,             // semua penerima
    //       delaySec,
    //     });

    //     const arr = Array.isArray(res?.results) ? res.results : [];
    //     const mapped = arr.map((r, i) => ({
    //       idx: r.index ?? i,
    //       number: r.number,
    //       name: rows[r.index ?? i]?.fullname || rows[r.index ?? i]?.name || rows[r.index ?? i]?.nama || '',
    //       status: 'done',
    //       response: r.ok ? { ok: true, id: r.id } : { ok: false, message: r.error || 'Gagal' },
    //     }));
    //     setResults(mapped);
    //     setInfo(`Selesai kirim ${kind}. OK: ${res?.sent ?? mapped.filter(x => x.response?.ok).length}/${res?.total ?? rows.length}`);
    //   } catch (e) {
    //     setErr(e?.message || 'Gagal mengirim media.');
    //   } finally {
    //     setSending(false);
    //   }
    //   return;
    // }

    // === CABANG MEDIA ===
    if (attachment) {
      setSending(true); setErr(''); setInfo('');

      // 1) tampilkan daftar target sebagai pending lebih dulu
      const initial = rows.map((row, i) => ({
        idx: i,
        number: row.number,
        name: row.fullname || row.name || row.nama || '',
        status: 'pending',
        response: null,
      }));
      setResults(initial);
      setCurrentIdx(-1);

      // 2) progress simulasi selama menunggu respons BE
      const stepMs = ms(Number(delaySec) * 1000 || 500);
      let i = 0;
      let simTimer = null;

      const startSim = () => {
        simTimer = setInterval(() => {
          setCurrentIdx((prev) => (i < initial.length ? i : -1));

          setResults(prev => prev.map(r => {
            if (r.idx === i) return { ...r, status: 'sending' };
            if (r.idx === i - 1 && r.status !== 'done') {
              return { ...r, status: 'done', response: { ok: true, optimistic: true } };
            }
            return r;
          }));

          i += 1;
          if (i >= initial.length) {
            setResults(prev => prev.map(r =>
              r.idx === initial.length - 1 ? { ...r, status: 'done', response: { ok: true, optimistic: true } } : r
            ));
            clearInterval(simTimer);
            simTimer = null;
            setCurrentIdx(-1);
          }
        }, stepMs);
      };

      try {
        startSim();

        const kind = attachment.type?.startsWith('image/') ? 'image' : 'document';
        const res = await sendMediaBatch(kind, {
          file: attachment,
          caption: message,
          rows,
          delaySec,
        });

        // 3) rekonsiliasi dengan hasil asli dari BE
        if (simTimer) { clearInterval(simTimer); simTimer = null; }
        setCurrentIdx(-1);

        const arr = Array.isArray(res?.results) ? res.results : [];
        const mapped = arr.map((r, idx) => ({
          idx: r.index ?? idx,
          number: r.number,
          name: rows[r.index ?? idx]?.fullname || rows[r.index ?? idx]?.name || rows[r.index ?? idx]?.nama || '',
          status: 'done',
          response: r.ok ? { ok: true, id: r.id } : { ok: false, message: r.error || 'Gagal' },
        }));

        setResults(prev => {
          const byIdx = new Map(mapped.map(x => [x.idx, x]));
          return prev.map(p => byIdx.get(p.idx) || p);
        });

        const okCount = res?.sent ?? mapped.filter(x => x.response?.ok).length;
        const totalCount = res?.total ?? rows.length;
        setInfo(`Selesai kirim ${kind}. OK: ${okCount}/${totalCount}`);
        if (res?.ok === false && res?.message) {
          setErr(`Beberapa kiriman gagal: ${res.message}`);
        }
      } catch (e) {
        if (e?.name !== 'AbortError') {
          setErr(e?.message || 'Gagal mengirim media.');
        }
      } finally {
        setCurrentIdx(-1);
        setSending(false);
      }
      return;
    }

    // === CABANG TEXT-ONLY (jalur lama, sequential) ===
    const initial = rows.map((row, i) => {
      const rendered = renderTemplate(message, row);
      return {
        idx: i,
        number: row.number,
        name: row.fullname || row.name || row.nama || '',
        rendered,
        status: 'pending',
        response: null,
      };
    });
    setResults(initial);
    setSending(true);
    setCurrentIdx(-1);

    try {
      for (let i = 0; i < initial.length; i++) {
        const row = initial[i];
        setCurrentIdx(i);
        setResults(prev => prev.map(r => r.idx === i ? { ...r, status: 'sending' } : r));
        await enforceRateLimiter(Number(limitPerMin));
        // const resp = await sendMessage(row.number, row.rendered, row.name); // text-only endpoint lama
        const resp = await sendMessage(
          row.number,
          row.rendered,
          row.name,
          {
            asalSekolah: row.asalSekolah,
            kelas: row.kelas,
            tahunLulusan: row.tahunLulusan,
            tanggalLahir: row.tanggalLahir,
            kodeBeasiswa: row.kodeBeasiswa
          }
        );
        setResults(prev => prev.map(r => r.idx === i ? ({ ...r, status: 'done', response: resp }) : r));
        sentTimestamps.current.push(Date.now());
        const d = Math.max(0, Number(delaySec) || 0) * 1000;
        if (i < initial.length - 1 && d > 0) await sleep(d);
      }
      setInfo('Pengiriman selesai.');
    } catch (e) {
      setErr(e?.message || 'Terjadi kesalahan saat mengirim.');
    } finally {
      setCurrentIdx(-1);
      setSending(false);
    }
  }

  const handleSaveDraft = () => {
    try {
      const payload = { message, delaySec, limitPerMin };
      localStorage.setItem('draft_send', JSON.stringify(payload));
      setInfo('Draft tersimpan di perangkat ini.');
    } catch {
      setErr('Gagal menyimpan draft.');
    }
  };

  const previewText = useMemo(() => {
    const sample = rows?.[0] || { nama: 'Ahmad Fauzi', fullname: 'Ahmad Fauzi' };
    return renderTemplate(message, sample);
  }, [message, rows]);

  return (
    <>
      {err && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded whitespace-pre-line">{err}</div>}
      {info && <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded">{info}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <h3 className="text-xl font-semibold mb-4">Kirim Pesan Blast</h3>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Isi Pesan (Caption kalau pakai lampiran)</label>
          <div className="border border-gray-300 dark:border-gray-600 rounded-lg">
            <div className="p-2 border-b border-gray-300 dark:border-gray-600 flex items-center space-x-2">
              <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Bold className="w-4 h-4" /></button>
              <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><Italic className="w-4 h-4" /></button>
              <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><List className="w-4 h-4" /></button>
              <div className="relative inline-block">
                <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center">
                  <Variable className="w-4 h-4 mr-1" /> Placeholder <ChevronDown className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
            <textarea
              rows={8}
              className="w-full p-3 bg-transparent focus:ring-0 border-0"
              value={message}
              onChange={(e)=>setMessage(e.target.value)}
              placeholder="Ketik pesan/caption..."
            />
          </div>

          <div className="flex justify-between items-center mt-2">
            <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline" onClick={()=>{
              const draft = localStorage.getItem('draft_send');
              if (!draft) return setInfo('Belum ada draft.');
              try {
                const d = JSON.parse(draft);
                setMessage(d.message || message);
                setDelaySec(d.delaySec ?? delaySec);
                setLimitPerMin(d.limitPerMin ?? limitPerMin);
                setInfo('Draft dimuat.');
              } catch {}
            }}>Gunakan Template/Draft</button>

            <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline" onClick={()=>setShowPreview(true)}>Preview Pesan</button>
          </div>

          {/* Lampiran */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Lampiran (Opsional)</label>
            <div className="flex items-center space-x-4">
              <label className="cursor-pointer flex items-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <Paperclip className="w-4 h-4 mr-2" />
                <span>Pilih File</span>
                <input ref={attachRef} type="file" className="hidden" onChange={onChooseAttachment} />
              </label>
              {attachment && (
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                  <span>{attachment.name}</span>
                  <button onClick={removeAttachment} className="ml-2 text-red-500 hover:text-red-700 font-bold">&times;</button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Gambar atau dokumen hingga 16MB. Jika ada lampiran, pesan ini digunakan sebagai <b>caption</b>.
            </p>
          </div>

          {/* Progress */}
          <div className="mt-6">
            <h4 className="font-semibold mb-2">Progress Pengiriman</h4>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div className="bg-indigo-600 h-4 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {attachment
                ? (sending ? 'Mengirim batch media…' : (results.length ? `Selesai: ${sentCount}/${total}` : 'Belum ada pengiriman...'))
                : (currentIdx >= 0
                    ? <>Sedang mengirim ke <b>{results[currentIdx]?.name || results[currentIdx]?.number}</b> ({currentIdx + 1}/{total})</>
                    : (sentCount > 0 ? `Terkirim: ${sentCount}/${total}` : 'Belum ada pengiriman...'))}
            </p>
          </div>

          {/* Tabel hasil */}
          {results.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
                <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2">No</th>
                    <th className="px-3 py-2">Nomor</th>
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => (
                    <tr key={`${r.number}-${idx}`} className="border-b dark:border-gray-700">
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="px-3 py-2">{r.number}</td>
                      <td className="px-3 py-2">{r.name || '-'}</td>
                      <td className="px-3 py-2">
                        {r.response == null
                          ? 'Mengirim…' // belum ada hasil dari BE (pending/sending)
                          : (r.response.ok
                              ? '✅ Terkirim'
                              : (r.response.message ? `❌ ${r.response.message}` : '❌ Gagal'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panel kanan */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
          <h3 className="font-semibold mb-4">Pengaturan</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Kontak Tujuan</label>
              <div className="mt-1 px-3 pt-3 pb-2 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                <ImportContacts onImported={(rows) => setContacts(rows || [])} />
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  CSV, XLS, XLSX hingga 10MB. Terbaca kolom: <code>number</code>, <code>fullname</code>, dst.
                </p>
                {rows.length > 0 && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Terpilih <b>{rows.length}</b> kontak unik.
                  </p>
                )}
              </div>
            </div>

            <NumberField label="Delay per Pesan (detik)" value={delaySec} setValue={setDelaySec} />
            <NumberField label="Limit per Menit" value={limitPerMin} setValue={setLimitPerMin} />

            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleSend}
                disabled={sending || total === 0 || !message.trim()}
                className="w-full flex justify-center py-2 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
              >
                <SendIcon className="w-4 h-4 mr-2" /> {sending ? 'Mengirim...' : `Kirim Sekarang (${total})`}
              </button>
              <button
                onClick={handleSaveDraft}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <Save className="w-4 h-4 mr-2" /> Simpan Draft
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-4 relative">
            <button onClick={()=>setShowPreview(false)} className="absolute right-3 top-3 text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>

          <div className="relative w-full max-w-xs mx-auto bg-gray-200 dark:bg-gray-900 rounded-3xl border-8 border-gray-700 dark:border-gray-600">
              <div className="h-6 bg-gray-700 dark:bg-gray-600 rounded-t-2xl flex justify-center items-center">
                <div className="w-12 h-1.5 bg-gray-800 dark:bg-gray-700 rounded-full" />
              </div>
              <div className="bg-cover bg-center h-80" style={{ backgroundImage: "url('https://i.ibb.co/6rC0rW5/wa-bg.png')" }}>
                <div className="p-3 flex flex-col h-full">
                  <div className="flex-grow overflow-y-auto pr-2">
                    <div className="flex justify-end">
                      <div className="max-w-xs">
                        <div className="bg-[#dcf8c6] dark:bg-green-900 text-gray-800 dark:text-gray-200 p-2.5 rounded-xl rounded-tr-none shadow">
                          {attachment && (
                            <div className="mb-2">
                              {attachment.type.startsWith('image/') ? (
                                <img className="rounded-lg w-full" src={URL.createObjectURL(attachment)} alt="preview" />
                              ) : (
                                <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-lg flex items-center">
                                  <FileText className="w-8 h-8 text-gray-500 flex-shrink-0" />
                                  <span className="ml-2 text-sm truncate">{attachment.name}</span>
                                </div>
                              )}
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{previewText}</p>
                          <p className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">10:35 AM ✓✓</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center">
              <button onClick={()=>setShowPreview(false)} className="py-2 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
