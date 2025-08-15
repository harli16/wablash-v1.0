import { useEffect, useState } from 'react';
import { getMessageLogsPaged, getMessageLogById, API_BASE } from '../api';
import { Search, RefreshCw, Download, X, ImageOff } from 'lucide-react';

function fmtTime(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return iso || '-'; }
}

function pick(val, ...alts) {
  for (const v of [val, ...alts]) if (v) return v;
  return '';
}

function buildMediaUrl(r) {
  const raw =
    r.mediaUrl ||
    r.url ||
    pick(r.meta?.url, r.meta?.mediaUrl, r.meta?.path, r.meta?.file) ||
    r.path ||
    r.fileUrl ||
    r.filePath ||
    '';

  if (!raw) return '';
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  return `${API_BASE.replace(/\/+$/,'')}/${raw.replace(/^\/+/, '')}`;
}

function normalize(row) {
  const number = pick(row.number, row.to, row.recipient, row.target, row.phone, row.msisdn, row.hp, '');
  const name = pick(row.name, row.fullname, row.contactName, row.recipientName, row.meta && (row.meta.name || row.meta.fullname));
  const kind =
    row.mediaType || row.kind ||
    (row.media ? (row.media.mimetype?.startsWith?.('image/') ? 'image' : 'document') : 'text');
  const ok = row.ok === true || row.status === 'success' || row.status === 'sent';

  return {
    _id: row._id,
    ts: row.createdAt || row.updatedAt || row.ts,
    number,
    name,
    kind,
    ok,
    message: row.message || row.caption || '',
    rawStatus: row.status || (ok ? 'sent' : 'failed'),
    error: row.error || row.messageError || '',
    id: row.id || row.messageId || row.wamid || '',
    mediaUrl: buildMediaUrl(row),

    // === Tambahan field baru ===
    asalSekolah: row.asalSekolah || '',
    kelas: row.kelas || '',
    tahunLulusan: row.tahunLulusan || '',
    tanggalLahir: row.tanggalLahir || '',
    kodeBeasiswa: row.kodeBeasiswa || ''
  };
}

function formatStatus(r) {
  if (r.ok) return '✅ Terkirim';
  if (/not a whatsapp number/i.test(r.error || r.message)) return '❌ Nomor bukan pengguna WhatsApp';
  return `❌ ${r.rawStatus || 'Gagal'}`;
}

function buildMediaUrlFromDetail(item) {
  const publicStreamUrl = `${API_BASE.replace(/\/+$/, '')}/api/wa/media/${item._id}`;
  const meta = item?.meta || {};

  const candidate =
    item.mediaUrl ||
    meta.mediaUrl ||
    meta.url ||
    meta.publicUrl ||
    meta.path ||
    meta.file ||
    '';

  if (!candidate) return publicStreamUrl;
  if (/^(https?:)?\/\//i.test(candidate) || candidate.startsWith('data:')) return candidate;

  // Tetap pakai streaming endpoint untuk path relatif supaya aman
  return publicStreamUrl;
}

export default function MessageLogs() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [preview, setPreview] = useState(null);

  async function openPreview(row) {
    setPreview({ ...row, loading: !!row._id, error: '', mediaError: false });

    if (!row._id) return;

    try {
      const detail = await getMessageLogById(row._id);
      const item = detail?.item || {};
      const mediaUrl = buildMediaUrlFromDetail(item);
      const resolvedKind = item.type || item.mediaType || row.kind || 'text';

      setPreview(prev => ({
        ...(prev || row),
        loading: false,
        message: item.message || item.caption || prev?.message || '',
        kind: resolvedKind,
        mediaUrl,
      }));
    } catch (e) {
      setPreview(prev => ({ ...(prev || row), loading: false, error: e?.message || 'Gagal mengambil detail' }));
    }
  }

  function closePreview() { setPreview(null); }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') closePreview(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function load() {
    setLoading(true); setErr('');
    try {
      const resp = await getMessageLogsPaged({ page, pageSize: limit, start, end, q, status });
      const items = (resp.items || []).map(normalize);
      setRows(items);
      setTotal(resp.total || items.length);
      setTotalPages(resp.totalPages || 1);
    } catch (e) {
      setErr(e?.message || 'Gagal memuat log');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, limit, start, end, q, status]);
  useEffect(() => { setPage(1); /* eslint-disable-next-line */ }, [start, end, q, status]);

  function exportCsv() {
    const header = ['Waktu','Nomor','Nama','Status','Pesan'];
    const lines = rows.map(r => [
      fmtTime(r.ts),
      r.number,
      r.name || '-',
      r.ok ? 'OK' : 'FAIL',
      (r.message || '').replace(/\r?\n/g, ' '),
    ]);
    const csv = [header, ...lines].map(a => a.map(x => `"${String(x ?? '').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'message-logs.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  function setToday() {
    const d = new Date();
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    const s = `${y}-${m}-${day}`;
    setStart(s); setEnd(s);
  }
  function setLast7() {
    const now = new Date();
    const from = new Date(now.getTime() - 6*24*60*60*1000);
    const fmt = x => `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
    setStart(fmt(from)); setEnd(fmt(now));
  }
  function clearDates() { setStart(''); setEnd(''); }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Log Pesan</h2>

      {err && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">{err}</div>}

      {/* Filter */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-4">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {/* Cari */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Cari</label>
            <div className="flex items-center border rounded-md px-2">
              <Search className="w-4 h-4 mr-2 text-gray-400" />
              <input
                value={q}
                onChange={e=>setQ(e.target.value)}
                placeholder="Nomor / nama / isi pesan"
                className="w-full py-1.5 bg-transparent outline-none"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select value={status} onChange={e=>setStatus(e.target.value)} className="w-full border rounded-md py-1.5 px-2">
              <option value="all">Semua</option>
              <option value="ok">Terkirim</option>
              <option value="fail">Gagal</option>
            </select>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-sm font-medium mb-1">Dari</label>
            <input type="date" className="w-full border rounded-md py-1.5 px-2" value={start} onChange={e=>setStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sampai</label>
            <input type="date" className="w-full border rounded-md py-1.5 px-2" value={end} onChange={e=>setEnd(e.target.value)} />
          </div>

          {/* Preset */}
          <div className="flex items-end gap-2">
            <button onClick={setToday} className="px-3 py-1.5 border rounded">Hari ini</button>
            <button onClick={setLast7} className="px-3 py-1.5 border rounded">7 hari</button>
            <button onClick={clearDates} className="px-3 py-1.5 border rounded">Clear</button>
          </div>

          {/* Action */}
          <div className="md:col-span-2 flex items-end gap-2">
            <button onClick={load} className="inline-flex items-center px-3 py-1.5 rounded-md bg-indigo-600 text-white">
              <RefreshCw className="w-4 h-4 mr-2" /> Muat Ulang
            </button>
            <button onClick={exportCsv} className="inline-flex items-center px-3 py-1.5 rounded-md border">
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </button>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">{total} data</span>
              <select value={limit} onChange={e=>setLimit(Number(e.target.value))} className="border rounded-md py-1 px-2">
                {[10,20,50,100,200].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
        <div className="mb-2 text-sm text-gray-600">
          {loading ? 'Memuat…' : `Halaman ${page} dari ${totalPages}`}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
            <thead className="text-xs uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2">Waktu</th>
                <th className="px-3 py-2">Nomor</th>
                <th className="px-3 py-2">Nama</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Isi / Caption</th>

                {/* Kolom baru */}
                <th className="px-3 py-2">Asal Sekolah</th>
                <th className="px-3 py-2">Kelas</th>
                <th className="px-3 py-2">Tahun Lulusan</th>
                <th className="px-3 py-2">Tanggal Lahir</th>
                <th className="px-3 py-2">Kode Beasiswa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.ts}-${r.number}-${i}`} className="border-b dark:border-gray-700">
                  <td className="px-3 py-2">{fmtTime(r.ts)}</td>
                  <td className="px-3 py-2 text-indigo-600 hover:text-indigo-800 underline cursor-pointer" onClick={() => openPreview(r)}>
                    {r.number}
                  </td>
                  <td className="px-3 py-2">{r.name || '-'}</td>
                  <td className="px-3 py-2">{formatStatus(r)}</td>
                  <td className="px-3 py-2 max-w-[320px] truncate" title={r.message}>{r.message || '-'}</td>

                  {/* Kolom baru */}
                  <td className="px-3 py-2">{r.asalSekolah || '-'}</td>
                  <td className="px-3 py-2">{r.kelas || '-'}</td>
                  <td className="px-3 py-2">{r.tahunLulusan || '-'}</td>
                  <td className="px-3 py-2">{r.tanggalLahir || '-'}</td>
                  <td className="px-3 py-2">{r.kodeBeasiswa || '-'}</td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={10}>Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-3 flex items-center gap-2 justify-end">
          <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1.5 border rounded disabled:opacity-50">Prev</button>
          <span className="text-sm">Page {page}/{totalPages}</span>
          <button disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1.5 border rounded disabled:opacity-50">Next</button>
        </div>
      </div>

      {/* Modal Preview */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) closePreview(); }}>
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Preview Chat</div>
                <div className="text-base font-semibold">{preview.name || '-'} • {preview.number}</div>
                <div className="text-xs text-gray-500">{fmtTime(preview.ts)}</div>
              </div>
              <button onClick={closePreview} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900">
              <div className="flex justify-end mb-2">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 bg-green-500/90 text-white shadow">
                  {preview.loading ? (
                    <div className="text-white/90">Memuat media…</div>
                  ) : (
                    <>
                      {preview.kind === 'image' && preview.mediaUrl ? (
                        <img
                          src={preview.mediaUrl}
                          alt="media"
                          className="rounded-lg mb-2 max-h-64 object-contain"
                          onError={() => setPreview(p => ({ ...p, mediaError: true }))}
                        />
                      ) : preview.kind === 'image' && preview.mediaError ? (
                        <div className="flex flex-col items-center justify-center text-gray-300">
                          <ImageOff className="w-12 h-12 mb-2" />
                          <span className="text-xs">Media tidak ditemukan</span>
                        </div>
                      ) : null}
                      <div className="whitespace-pre-wrap break-words">
                        {preview.message || (preview.kind !== 'text' ? '(tidak ada caption)' : '')}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!preview.loading && preview.kind !== 'text' && (
                <div className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                  Jenis: <span className="uppercase">{preview.kind}</span>
                  {' • '}
                  {preview.mediaUrl
                    ? <a href={preview.mediaUrl} target="_blank" rel="noreferrer" className="underline">Buka Media</a>
                    : 'Media tidak tersedia'}
                </div>
              )}

              {preview.error && (
                <div className="mt-3 text-xs text-red-600">{preview.error}</div>
              )}
            </div>

            <div className="px-4 py-3 border-t dark:border-gray-700 flex justify-end">
              <button onClick={closePreview} className="px-4 py-2 rounded-md border">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
