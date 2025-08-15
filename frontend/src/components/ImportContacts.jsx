import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { normalizeNumber } from '../utils/normalizeNumber';

export default function ImportContacts({ onImported }) {
  const inputRef = useRef(null);
  const [info, setInfo] = useState({ rows: 0, valid: 0, invalid: 0, fields: [] });
  const [loading, setLoading] = useState(false);

  const openPicker = () => inputRef.current?.click();

  async function parseFile(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    const buf = await file.arrayBuffer();

    let rows = [];

    if (ext === 'csv') {
      const text = new TextDecoder().decode(buf);
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      rows = parsed.data;
    } else {
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' }); // objek per baris, header dari row1
    }

    // Normalisasi number dan tandai invalid
    const out = [];
    let invalid = 0;

    for (const r of rows) {
      // cari kolom "number" (wajib). Toleransi huruf besar/kecil & spasi
      const keys = Object.keys(r);
      const keyNumber = keys.find(k => k.trim().toLowerCase() === 'number');
      if (!keyNumber) { invalid++; continue; }

      const num = normalizeNumber(r[keyNumber]);
      if (!num) { invalid++; continue; }

      out.push({ ...r, number: num });
    }

    const fields = out.length ? Object.keys(out[0]) : [];
    setInfo({ rows: rows.length, valid: out.length, invalid, fields });

    if (typeof onImported === 'function') onImported(out);
  }

  const onChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try { await parseFile(file); }
    catch (err) { alert(err?.message || 'Gagal membaca file.'); }
    finally { setLoading(false); e.target.value = ''; }
  };

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#eef2ff',
                  padding: 10, borderRadius: 8, margin: '8px 0' }}>
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
      <div style={{ fontSize: 12 }}>
        {info.rows === 0
          ? <>Pilih file. Kolom wajib: <b>number</b>. Kolom lain bebas: <code>fullname</code>, <code>kelas</code>, <code>asal_sekolah</code>, dll.</>
          : <>Baris: <b>{info.rows}</b> • Valid: <b>{info.valid}</b> • Invalid: <b>{info.invalid}</b> • Field: {info.fields.join(', ')}</>}
      </div>
    </div>
  );
}
