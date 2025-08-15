// Ganti [field] pada template dengan nilai dari row (case-insensitive).
export function renderTemplate(template, row) {
  if (!template) return '';
  // buat map field lower-case -> value
  const map = {};
  Object.keys(row || {}).forEach(k => { map[k.toLowerCase()] = row[k]; });

  // format: [field] atau [field|YYYY-MM-DD]
  return String(template).replace(/\[([a-zA-Z0-9_]+)(?:\|([^\]]+))?\]/g, (_, key, fmt) => {
    const v = map[key.toLowerCase()];
    if (v == null || v === '') return '';
    if (fmt && isValidDate(v)) return formatDate(v, fmt);
    return String(v);
  });
}

function isValidDate(x) {
  // dukung Date, timestamp, atau string tanggal yang bisa di-parse
  const d = x instanceof Date ? x : new Date(x);
  return !isNaN(d.getTime());
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function formatDate(x, fmt) {
  const d = x instanceof Date ? x : new Date(x);
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return fmt
    .replace(/YYYY/g, YYYY)
    .replace(/MM/g, MM)
    .replace(/DD/g, DD)
    .replace(/hh/g, hh)
    .replace(/mm/g, mm)
    .replace(/ss/g, ss);
}
