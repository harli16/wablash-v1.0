// backend/routes/messageMedia.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { MessageMedia } = require('whatsapp-web.js');

const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getClient } = require('../services/whatsapp');
const { saveLogSafe } = require('../utils/saveLog');

function normalizeNumber(raw) {
  let n = String(raw || '').replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('0')) n = '62' + n.slice(1);
  return /^62\d{6,}$/.test(n) ? n : null;
}

function fillTemplate(text, row = {}) {
  if (!text) return text;
  return text.replace(/\[([a-zA-Z0-9_]+)\]/g, (_, key) => {
    const v = row[key] ?? row[key?.toLowerCase()];
    return (v !== undefined && v !== null) ? String(v) : `[${key}]`;
  }).trim();
}

async function ensureReady(client, timeoutMs = 15000) {
  if (client.info && client.info.wid) return;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('WA client not ready (timeout)')), timeoutMs);
    client.once('ready', () => { clearTimeout(t); resolve(); });
  });
}

// Folder permanen untuk simpan semua file
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'media');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, `${ts}-${safe}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 16 * 1024 * 1024 } });

// Helper untuk proses kirim & log
async function sendAndLogMedia({
  client, req, num, name, message, type, filePath
}) {
  const media = await MessageMedia.fromFilePath(filePath);
  const sent = await client.sendMessage(`${num}@c.us`, media, { caption: message });
  // path relatif yang disimpan untuk endpoint /api/wa/media/:id
  const relativePath = `/uploads/media/${path.basename(filePath)}`;

  await saveLogSafe({
    user: req.user?.id,
    to: num,
    name,
    message,
    type,
    status: 'sent',
    mediaPath: relativePath,
    meta: { path: relativePath, waMsgId: sent?.id?.id }
  });
  return sent?.id?.id;
}

// ====================== IMAGE ======================
router.post('/send-image', authenticateToken, upload.single('file'), async (req, res) => {
  const client = await getClient();
  try { await ensureReady(client); }
  catch { return res.status(503).json({ ok:false, code:'WA_NOT_READY' }); }

  const { number, caption = '', rows, delayMs = 0 } = req.body || {};
  const filePath = req.file?.path;
  if (!filePath) return res.status(400).json({ ok:false, code:'NO_FILE' });

  if (rows) {
    let arr;
    try { arr = JSON.parse(rows); }
    catch { return res.status(400).json({ ok:false, code:'BAD_ROWS_JSON' }); }

    const results = [];
    for (let i=0;i<arr.length;i++){
      const row = arr[i] || {};
      const raw = row.number ?? row.nomor ?? row.phone;
      const num = normalizeNumber(raw);
      const text = fillTemplate(caption, row) || '';
      const name = row.fullname || row.name || row.nama || '';

      if (!num) {
        await saveLogSafe({ user:req.user?.id, to:raw||'unknown', name, message:text, type:'image', status:'failed', error:'BAD_NUMBER' });
        results.push({index:i, number:raw, ok:false, error:'Invalid number format'});
        continue;
      }

      try {
        const wid = await client.getNumberId(num);
        if (!wid) {
          await saveLogSafe({ user:req.user?.id, to:num, name, message:text, type:'image', status:'failed', error:'NOT_WHATSAPP' });
          results.push({index:i, number:raw, ok:false, error:'Not a WhatsApp number'});
          continue;
        }
        const msgId = await sendAndLogMedia({ client, req, num, name, message:text, type:'image', filePath });
        results.push({index:i, number:raw, ok:true, id: msgId});
      } catch(e) {
        await saveLogSafe({ user:req.user?.id, to:num||raw||'unknown', name, message:text, type:'image', status:'failed', error:e?.message||String(e) });
        results.push({index:i, number:raw, ok:false, error:e?.message||String(e)});
      }

      if (delayMs>0 && i<arr.length-1) await new Promise(r=>setTimeout(r, Number(delayMs)));
    }
    const okCount = results.filter(r=>r.ok).length;
    return res.json({ ok: okCount===results.length, sent: okCount, total: results.length, results });
  }

  const num = normalizeNumber(number);
  const singleName = req.body?.name || '';
  if (!num) {
    await saveLogSafe({ user:req.user?.id, to:number, name: singleName, message:caption, type:'image', status:'failed', error:'BAD_NUMBER' });
    return res.status(400).json({ ok:false, code:'BAD_NUMBER' });
  }

  try {
    const wid = await client.getNumberId(num);
    if (!wid) {
      await saveLogSafe({ user:req.user?.id, to:num, name: singleName, message:caption, type:'image', status:'failed', error:'NOT_WHATSAPP' });
      return res.status(400).json({ ok:false, code:'NOT_WHATSAPP' });
    }
    const msgId = await sendAndLogMedia({ client, req, num, name: singleName, message: caption, type:'image', filePath });
    return res.json({ ok:true, id: msgId });
  } catch(e) {
    await saveLogSafe({ user:req.user?.id, to:num, name: singleName, message:caption, type:'image', status:'failed', error:e?.message||String(e) });
    return res.status(500).json({ ok:false, code:'SEND_FAIL', message: e?.message||String(e) });
  }
});

// ====================== DOCUMENT ======================
router.post('/send-doc', authenticateToken, upload.single('file'), async (req, res) => {
  const client = await getClient();
  try { await ensureReady(client); }
  catch { return res.status(503).json({ ok:false, code:'WA_NOT_READY' }); }

  const { number, caption = '', rows, delayMs = 0 } = req.body || {};
  const filePath = req.file?.path;
  if (!filePath) return res.status(400).json({ ok:false, code:'NO_FILE' });

  if (rows) {
    let arr;
    try { arr = JSON.parse(rows); }
    catch { return res.status(400).json({ ok:false, code:'BAD_ROWS_JSON' }); }

    const results = [];
    for (let i=0;i<arr.length;i++){
      const row = arr[i] || {};
      const raw = row.number ?? row.nomor ?? row.phone;
      const num = normalizeNumber(raw);
      const text = fillTemplate(caption, row) || '';
      const name = row.fullname || row.name || row.nama || '';

      if (!num) {
        await saveLogSafe({ user:req.user?.id, to:raw||'unknown', name, message:text, type:'document', status:'failed', error:'BAD_NUMBER' });
        results.push({index:i, number:raw, ok:false, error:'Invalid number format'});
        continue;
      }

      try {
        const wid = await client.getNumberId(num);
        if (!wid) {
          await saveLogSafe({ user:req.user?.id, to:num, name, message:text, type:'document', status:'failed', error:'NOT_WHATSAPP' });
          results.push({index:i, number:raw, ok:false, error:'Not a WhatsApp number'});
          continue;
        }
        const msgId = await sendAndLogMedia({ client, req, num, name, message:text, type:'document', filePath });
        results.push({index:i, number:raw, ok:true, id: msgId});
      } catch(e) {
        await saveLogSafe({ user:req.user?.id, to:num||raw||'unknown', name, message:text, type:'document', status:'failed', error:e?.message||String(e) });
        results.push({index:i, number:raw, ok:false, error:e?.message||String(e)});
      }

      if (delayMs>0 && i<arr.length-1) await new Promise(r=>setTimeout(r, Number(delayMs)));
    }
    const okCount = results.filter(r=>r.ok).length;
    return res.json({ ok: okCount===results.length, sent: okCount, total: results.length, results });
  }

  const num = normalizeNumber(number);
  const singleName = req.body?.name || '';
  if (!num) {
    await saveLogSafe({ user:req.user?.id, to:number, name: singleName, message:caption, type:'document', status:'failed', error:'BAD_NUMBER' });
    return res.status(400).json({ ok:false, code:'BAD_NUMBER' });
  }

  try {
    const wid = await client.getNumberId(num);
    if (!wid) {
      await saveLogSafe({ user:req.user?.id, to:num, name: singleName, message:caption, type:'document', status:'failed', error:'NOT_WHATSAPP' });
      return res.status(400).json({ ok:false, code:'NOT_WHATSAPP' });
    }
    const msgId = await sendAndLogMedia({ client, req, num, name: singleName, message: caption, type:'document', filePath });
    return res.json({ ok:true, id: msgId });
  } catch(e) {
    await saveLogSafe({ user:req.user?.id, to:num, name: singleName, message:caption, type:'document', status:'failed', error:e?.message||String(e) });
    return res.status(500).json({ ok:false, code:'SEND_FAIL', message: e?.message||String(e) });
  }
});

module.exports = router;
