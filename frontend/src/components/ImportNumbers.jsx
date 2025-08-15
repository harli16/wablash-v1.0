import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { normalizeNumber } from '../utils/normalizeNumber';

export default function ImportNumbers({ onImported }) {
  const inputRef = useRef(null);
  const [info, setInfo] = useState({ total: 0, valid: 0, invalid: 0, sample: [] });
  const [loading, setLoading] = useState(false);

  const openPicker = () => inputRef.current?.click();

  async function parseFile(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    const buf = await file.arrayBuffer();

    let rawValues = [];

    if (ext === 'csv') {
      const text = new TextDecoder().decode(buf);
      const parsed = Papa.parse(text, { skipEmptyLines: true });
      // parsed.data: array of rows; ambil semua sel
      rawValues = parsed.data.flat().map(String);
    } else {
      // xlsx / xls
      const wb = XLSX.read(buf, { type: 'array' });
      const all = [];
      wb.SheetNames.forEach((name) => {
        const ws = wb.Sheets[name];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }); // array of rows
        all.push(...json);
      });
      rawValues = all.flat().map(String);
    }

    // Ambil yang terlihat seperti nomor (mengandung digit), normalisasi
    const normalized = [];
    const invalids = [];
    for (const cell of rawValues) {
      // ekstrak kandidat: pecah spasi/koma/semicolon di satu sel
      const parts = String(cell).split(/[\s,;]+/).filter(Boolean);
      for (const p of parts) {
        const num = normalizeNumber(p);
        if (num) normalized.push(num);
        else if (/\d/.test(p)) invalids.push(p);
      }
    }

    // Deduplicate
    const uniq = Array.from(new Set(normalized));

    // Batasi agar tidak kebablasan (opsional)
    const limited = uniq.slice(0, 5000);

    setInfo({
      total: rawValues.length,
      valid: limited.length,
      invalid: invalids.length,
      sample: limited.slice(0, 5),
    });

    if (typeof onImported === 'function') onImported(limited);
  }

  const onChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await parseFile(file);
    } catch (err) {
      alert(err?.message || 'Gagal membaca file.');
    } finally {
      setLoading(false);
      e.target.value = ''; // reset chooser
    }
  };

  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'center',
      background: '#eef2ff', padding: 10, borderRadius: 8, margin: '8px 0'
    }}>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={onChange}
      />
      <button onClick={openPicker} disabled={loading}>
        {loading ? 'Mengimpor...' : 'Import CSV/Excel'}
      </button>
      <div style={{ fontSize: 12, color: '#333' }}>
        {info.valid > 0
          ? <>Diimpor <b>{info.valid}</b> nomor (contoh: {info.sample.join(', ')})</>
          : <>Pilih file .csv/.xlsx berisi kolom nomor</>}
        {info.invalid > 0 && <> • {info.invalid} sel tidak valid diabaikan</>}
      </div>
    </div>
  );
}
