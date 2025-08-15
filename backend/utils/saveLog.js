// backend/utils/saveLog.js
const MessageLog = require('../models/MessageLog');

/**
 * Simpan log tanpa mematikan alur kalau error.
 * Field yang didukung:
 * - user
 * - number | to          -> to
 * - name                 -> name
 * - message              -> message
 * - mediaType | type     -> type ('text'|'image'|'document')
 * - status ('sent'|'failed'|'success'|'queued')
 * - ok (boolean)         -> ikut disimpan & bisa menurunkan status jika status belum ada
 * - id                   -> id pesan WA
 * - error                -> error string
 * - meta                 -> object bebas
 * - mediaPath            -> path langsung ke file media (opsional)
 */
async function saveLogSafe(doc = {}) {
  try {
    const payload = {};

    // user
    if (doc.user) payload.user = doc.user;

    // nomor tujuan
    if (doc.number) payload.to = doc.number;
    else if (doc.to) payload.to = doc.to;
    else payload.to = 'unknown';

    // nama penerima
    if (typeof doc.name === 'string') payload.name = doc.name;
    else if (doc.fullname || doc.Fullname || doc.nama || doc.Nama) {
      payload.name = doc.fullname || doc.Fullname || doc.nama || doc.Nama;
    }

    // isi / caption
    if (doc.message !== undefined) payload.message = String(doc.message ?? '');

    // jenis pesan
    if (doc.mediaType) payload.type = doc.mediaType;
    else payload.type = doc.type || 'text';

    // status & ok
    if (typeof doc.ok === 'boolean') payload.ok = doc.ok;
    if (doc.status) {
      payload.status = doc.status; // hormati status eksplisit
    } else if (typeof doc.ok === 'boolean') {
      payload.status = doc.ok ? 'success' : 'failed';
    } else {
      payload.status = 'failed'; // default aman
    }

    // id pesan & error & meta
    if (doc.id != null) payload.id = String(doc.id);
    if (doc.error != null) payload.error = String(doc.error);
    payload.meta = doc.meta ?? {};

    // === NEW: Simpan path media langsung kalau ada ===
    if (doc.mediaPath) {
      payload.mediaPath = doc.mediaPath;
    } else if (doc.media && doc.media.path) {
      payload.mediaPath = doc.media.path;
    } else if (doc.meta && doc.meta.path) {
      payload.mediaPath = doc.meta.path;
    } else if (doc.meta && doc.meta.file) {
      payload.mediaPath = doc.meta.file;
    }

    await MessageLog.create(payload);
  } catch (e) {
    console.error('[MessageLog] save failed:', e?.message || e);
  }
}

module.exports = { saveLogSafe };
