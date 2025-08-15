// src/utils/statusLabel.js
export function statusLabel(resp) {
  if (!resp) return '';
  if (resp.ok) return '✅ Terkirim';
  switch (resp.code) {
    case 'INVALID_NUMBER': return '🚫 Bukan nomor WA';
    case 'INVALID_FORMAT': return '❌ Format salah';
    case 'SEND_FAILED':    return '⚠️ Gagal kirim';
    case 'BAD_REQUEST':    return '⚠️ Data kurang';
    default:               return '⚠️ Gagal';
  }
}
