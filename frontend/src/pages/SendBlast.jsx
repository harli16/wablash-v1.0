import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

/**
 * SendBlast.jsx — one page to:
 * - upload Excel (XLS/XLSX/CSV) and preview rows
 * - compose message template with placeholders like [fullname], [tanggal]
 * - choose mode: text / image / document
 * - pick media file (for image/document modes)
 * - set delayMs between sends
 * - blast via backend endpoints you already built
 *
 * Requirements in your app:
 *   npm i xlsx
 *   TailwindCSS recommended (classes used below). If not available, it's still usable with basic CSS.
 *
 * API_BASE can be configured via Vite env: VITE_API_BASE=http://localhost:3001
 * If empty, it will use same-origin (proxy dev server to 3001 recommended).
 */
// Selaras dengan pola di src/api.js (CRA)
const API_BASE =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_BACKEND_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? `${window.location.protocol}//localhost:3001`
    : '');

function classNames(...xs) { return xs.filter(Boolean).join(" "); }

const sampleRows = [
  { number: "6281818434350", fullname: "ADI", tanggal: "14-08-2025" },
  { number: "6282129328462", fullname: "BUDI", tanggal: "15-08-2025" }
];

export default function SendBlast() {
  const tokenRef = useRef(null);
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState("text"); // 'text' | 'image' | 'document'
  const [message, setMessage] = useState("Halo [fullname], mohon bayar sebelum [tanggal].");
  const [delayMs, setDelayMs] = useState(750);
  const [rows, setRows] = useState(sampleRows);
  const [mediaFile, setMediaFile] = useState(null);

  const [sending, setSending] = useState(false);
  const [results, setResults] = useState([]); // [{index, number, ok, id?, error?}]
  const [sentCount, setSentCount] = useState(0);

  const token = useMemo(() => {
    // prefer passed token; else localStorage
    return tokenRef.current?.value || localStorage.getItem("token") || "";
  }, [tokenRef.current?.value]);

  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (f) setMediaFile(f);
  }

  function parseExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
          resolve(json);
        } catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  async function onUploadExcel(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const json = await parseExcel(f);
      // normalize headers to our expected keys if possible
      const normalized = json.map((r) => ({
        number: r.number || r.nomor || r.phone || r.hp || r.telp || "",
        fullname: r.fullname || r.nama || r.name || "",
        tanggal: r.tanggal || r.date || r.deadline || "",
        ...r,
      }));
      setRows(normalized);
    } catch (e) {
      alert("Gagal baca Excel: " + e.message);
    } finally {
      e.target.value = "";
    }
  }

  function fillTemplate(text, row = {}) {
    if (!text) return text;
    return text.replace(/\[([a-zA-Z0-9_]+)\]/g, (_, key) => {
      const v = row[key] ?? row[key?.toLowerCase()];
      return v !== undefined && v !== null && String(v).length ? String(v) : `[${key}]`;
    }).trim();
  }

  function previewFor(row) {
    return fillTemplate(message, row);
  }

  async function sendTextBatch() {
    const payload = { message, delayMs: Number(delayMs) || 0, rows };
    const res = await fetch(`${API_BASE}/api/message/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  }

  async function sendMediaBatch(kind /* image|document */) {
    if (!mediaFile) throw new Error("Pilih file terlebih dahulu");
    const fd = new FormData();
    fd.append("file", mediaFile);
    fd.append("caption", message || "");
    fd.append("rows", JSON.stringify(rows));
    fd.append("delayMs", String(Number(delayMs) || 0));

    const url = kind === "image" ? `${API_BASE}/api/message/send-image` : `${API_BASE}/api/message/send-doc`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json();
    return data;
  }

  async function onSend() {
    if (!token) {
      alert("Token login tidak ditemukan. Pastikan sudah login dan token tersimpan di localStorage.");
      return;
    }
    if (!rows?.length) {
      alert("Rows kosong. Upload Excel atau tambah minimal 1 baris.");
      return;
    }
    if ((mode === "image" || mode === "document") && !mediaFile) {
      alert("Pilih file media terlebih dahulu.");
      return;
    }

    setSending(true);
    setResults([]);
    setSentCount(0);
    try {
      const data = mode === "text" ? await sendTextBatch() : await sendMediaBatch(mode);
      setResults(data.results || []);
      setSentCount(data.sent || 0);
    } catch (e) {
      alert("Gagal mengirim: " + e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">WA Blast — Send</h1>
          <div className="flex items-center gap-2">
            <input
              ref={tokenRef}
              className="px-3 py-2 rounded border w-80"
              placeholder="Token (kosongkan pakai localStorage)"
              defaultValue={localStorage.getItem("token") || ""}
              onChange={() => {/* trigger useMemo by re-render */}}
            />
            <button
              className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
              onClick={() => {
                const v = tokenRef.current?.value || "";
                if (v) localStorage.setItem("token", v); else localStorage.removeItem("token");
                alert("Token disimpan ke localStorage");
              }}
            >Simpan Token</button>
          </div>
        </header>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl shadow">
            <label className="block text-sm font-medium mb-2">Mode</label>
            <div className="flex gap-2">
              {["text","image","document"].map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={classNames(
                    "px-3 py-2 rounded-full border",
                    mode === m ? "bg-black text-white" : "bg-white hover:bg-gray-100"
                  )}
                >{m}</button>
              ))}
            </div>

            {(mode === "image" || mode === "document") && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">File {mode}</label>
                <input ref={fileInputRef} type="file" onChange={onPickFile} />
                {mediaFile && (
                  <p className="text-xs text-gray-600 mt-1">{mediaFile.name} • {(mediaFile.size/1024/1024).toFixed(2)} MB</p>
                )}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Delay (ms)</label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 rounded border"
                value={delayMs}
                onChange={(e) => setDelayMs(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow md:col-span-2">
            <label className="block text-sm font-medium mb-2">
              {mode === "text" ? "Pesan" : "Caption"} (bisa pakai [fullname], [tanggal], ...)
            </label>
            <textarea
              className="w-full h-28 px-3 py-2 rounded border"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="text-xs text-gray-500 mt-2">Contoh placeholder: [fullname], [tanggal]. Akan diisi dari kolom di Excel.</div>
          </div>
        </div>

        {/* Excel & Rows */}
        <div className="bg-white p-4 rounded-2xl shadow">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Upload Excel/CSV</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={onUploadExcel} />
            </div>
            <button
              className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
              onClick={() => setRows(sampleRows)}
              type="button"
            >Gunakan Contoh</button>
          </div>

          <div className="mt-4 overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">number</th>
                  <th className="p-2 text-left">fullname</th>
                  <th className="p-2 text-left">tanggal</th>
                  <th className="p-2 text-left">Preview</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{i+1}</td>
                    <td className="p-2">
                      <input
                        className="px-2 py-1 rounded border w-44"
                        value={r.number || ""}
                        onChange={(e) => {
                          const copy = [...rows];
                          copy[i] = { ...copy[i], number: e.target.value };
                          setRows(copy);
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="px-2 py-1 rounded border w-44"
                        value={r.fullname || ""}
                        onChange={(e) => {
                          const copy = [...rows];
                          copy[i] = { ...copy[i], fullname: e.target.value };
                          setRows(copy);
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="px-2 py-1 rounded border w-40"
                        value={r.tanggal || ""}
                        onChange={(e) => {
                          const copy = [...rows];
                          copy[i] = { ...copy[i], tanggal: e.target.value };
                          setRows(copy);
                        }}
                      />
                    </td>
                    <td className="p-2 w-[36rem]">
                      <div className="text-gray-700 line-clamp-2">{previewFor(r)}</div>
                    </td>
                    <td className="p-2">
                      {results.find(x => x.index === i) ? (
                        results.find(x => x.index === i)?.ok ? (
                          <span className="text-green-600">✅ OK</span>
                        ) : (
                          <span className="text-red-600" title={results.find(x => x.index === i)?.error}>❌ Gagal</span>
                        )
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSend}
            disabled={sending}
            className={classNames(
              "px-4 py-2 rounded-2xl shadow",
              sending ? "bg-gray-300" : "bg-black text-white hover:opacity-90"
            )}
          >{sending ? "Mengirim..." : "Kirim"}</button>

          <div className="text-sm text-gray-700">
            Progress: <b>{sentCount}</b> / {rows.length}
          </div>
        </div>

        {/* Results */}
        {results?.length > 0 && (
          <div className="bg-white p-4 rounded-2xl shadow">
            <h3 className="font-semibold mb-2">Hasil</h3>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Number</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">WA Msg ID / Error</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.index+1}</td>
                      <td className="p-2">{r.number}</td>
                      <td className="p-2">{r.ok ? "OK" : "FAILED"}</td>
                      <td className="p-2">{r.ok ? (r.id || "-") : (r.error || "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
