// backend/routes/messageSend.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getClient } = require('../services/whatsapp');
const { saveLogSafe } = require('../utils/saveLog');

/** Normalisasi nomor ke 62xxx (tanpa @c.us) */
function normalizeNumber(raw) {
  let n = String(raw || '').replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('0')) n = '62' + n.slice(1);
  return /^62\d{6,}$/.test(n) ? n : null;
}

/** Isi template: "Halo [fullname]" -> ambil dari row */
function fillTemplate(text, row = {}) {
  if (!text) return text;
  return text.replace(/\[([a-zA-Z0-9_]+)\]/g, (_, key) => {
    const v = row[key] ?? row[key?.toLowerCase()];
    return (v !== undefined && v !== null) ? String(v) : `[${key}]`;
  }).trim();
}

/** Ambil nama penerima (case-insensitive, dukung variasi key) */
function pickName(src) {
  try {
    if (!src || typeof src !== 'object') return '';
    for (const k of Object.keys(src)) {
      const kl = k.toLowerCase().replace(/\s|_/g, ''); // "Full Name" -> "fullname"
      if (['fullname','name','nama','contactname','recipientname'].includes(kl)) {
        const v = src[k];
        if (v != null && String(v).trim().length) return String(v).trim();
      }
    }
    return '';
  } catch { return ''; }
}

/** Tunggu WA client ready (maks 15 detik) */
async function ensureReady(client, timeoutMs = 15000) {
  if (client.info && client.info.wid) return;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('WA client not ready (timeout)')), timeoutMs);
    client.once('ready', () => { clearTimeout(t); resolve(); });
  });
}

/** MODE SINGLE: {number, message, (nama bisa: name/Fullname/Nama/...)} */
router.post('/api/message/send', authenticateToken, async (req, res, next) => {
  try {
    const { number, message, rows, delayMs = 0 } = req.body || {};
    const name = pickName(req.body); // ⬅️ ambil nama dari body (case-insensitive)

    // --- Jika ada rows -> alihkan ke handler batch ---
    if (Array.isArray(rows) && rows.length) {
      return next(); // diteruskan ke route di bawah (batch)
    }

    // --- Single send ---
    if (!number || !message) {
      await saveLogSafe({
        user: req.user?.id,
        to: number,
        name,
        message,
        status: 'failed',
        error: 'BAD_REQUEST(single)'
      });
      return res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'number & message wajib' });
    }

    const num = normalizeNumber(number);
    if (!num) {
      await saveLogSafe({
        user: req.user?.id,
        to: number,
        name,
        message,
        status: 'failed',
        error: 'BAD_NUMBER'
      });
      return res.status(400).json({ ok: false, code: 'BAD_NUMBER', message: 'Format nomor tidak valid' });
    }

    const client = await getClient();
    await ensureReady(client);

    // Pastikan nomor punya WhatsApp
    const wid = await client.getNumberId(num);
    if (!wid) {
      await saveLogSafe({
        user: req.user?.id,
        to: num,
        name,
        message,
        status: 'failed',
        error: 'NOT_WHATSAPP',
        meta: { jid: `${num}@c.us` }
      });
      return res.status(400).json({ ok: false, code: 'NOT_WHATSAPP', message: 'Nomor tidak terdaftar WA' });
    }

    const sent = await client.sendMessage(`${num}@c.us`, message);

    await saveLogSafe({
      user: req.user?.id,
      to: num,
      name,
      message,
      type: 'text',
      status: 'sent',
      meta: { jid: `${num}@c.us`, waMsgId: sent?.id?.id }
    });

    res.json({ ok: true, id: sent?.id?.id });
  } catch (e) {
    await saveLogSafe({
      user: req.user?.id,
      to: req.body?.number,
      name: pickName(req.body), // ⬅️ jaga-jaga saat error
      message: req.body?.message,
      status: 'failed',
      error: e?.message || String(e)
    });
    next(e);
  }
});

/** MODE BATCH (rows) */
router.post('/api/message/send', authenticateToken, async (req, res) => {
  const { message, rows = [], delayMs = 0 } = req.body || {};

  if (!message) {
    return res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'message wajib' });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'rows wajib' });
  }

  const client = await getClient();
  try {
    await ensureReady(client);
  } catch {
    return res.status(503).json({ ok: false, code: 'WA_NOT_READY', message: 'WhatsApp client not ready' });
  }

  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const raw = row.number ?? row.nomor ?? row.phone;
    const num = normalizeNumber(raw);
    const text = fillTemplate(message, row) || ''; // minimal string kosong agar schema aman
    const name = pickName(row); // ⬅️ AMBIL NAMA DARI ROW (case-insensitive)

    if (!num) {
      await saveLogSafe({
        user: req.user?.id,
        to: raw || 'unknown',
        name,
        message: text,
        status: 'failed',
        error: 'BAD_NUMBER'
      });
      results.push({ index: i, number: raw, ok: false, error: 'Invalid number format' });
      continue;
    }

    try {
      const wid = await client.getNumberId(num);
      if (!wid) {
        await saveLogSafe({
          user: req.user?.id,
          to: num,
          name,
          message: text,
          status: 'failed',
          error: 'NOT_WHATSAPP',
          meta: { jid: `${num}@c.us` }
        });
        results.push({ index: i, number: raw, ok: false, error: 'Not a WhatsApp number' });
        continue;
      }

      const sent = await client.sendMessage(`${num}@c.us`, text);

      await saveLogSafe({
        user: req.user?.id,
        to: num,
        name,
        message: text,
        type: 'text',
        status: 'sent',
        meta: { jid: `${num}@c.us`, waMsgId: sent?.id?.id }
      });

      results.push({ index: i, number: raw, ok: true, id: sent?.id?.id });
    } catch (e) {
      await saveLogSafe({
        user: req.user?.id,
        to: num || raw || 'unknown',
        name,
        message: text,
        status: 'failed',
        error: e?.message || String(e)
      });
      results.push({ index: i, number: raw, ok: false, error: e?.message || String(e) });
    }

    if (delayMs > 0 && i < rows.length - 1) {
      await new Promise(r => setTimeout(r, Number(delayMs)));
    }
  }

  const okCount = results.filter(r => r.ok).length;
  res.json({ ok: okCount === results.length, sent: okCount, total: rows.length, results });
});

module.exports = router;
