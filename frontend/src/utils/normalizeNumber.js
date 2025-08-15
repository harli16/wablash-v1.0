// Hasil: 62xxxxxxxxxx atau null kalau tidak valid
export function normalizeNumber(input) {
  if (!input) return null;
  let n = String(input).trim();

  // Ambil semua digit & '+' diawal, buang simbol lain
  n = n.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);

  // 08xxxx -> 628xxxx
  if (n.startsWith('08')) n = '62' + n.slice(1);

  // Kalau masih mulai 0 (contoh 0xxxxx), anggap lokal -> 62
  if (n.startsWith('0')) n = '62' + n.slice(1);

  // Validasi panjang angka
  if (!/^\d{8,20}$/.test(n)) return null;
  return n;
}
