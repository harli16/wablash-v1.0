// backend/routes/wa.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { authenticateToken } = require('../middleware/auth');
const { getClient, getState, getLastQr, resetSession } = require('../services/whatsapp');
const MessageLog = require('../models/MessageLog');

// Util kecil: bikin range tanggal inklusif (end ikut sampai 23:59:59.999)
function buildDateRange(start, end) {
  const range = {};
  if (start) {
    const s = new Date(String(start) + 'T00:00:00');
    if (!isNaN(s)) range.$gte = s;
  }
  if (end) {
    const e0 = new Date(String(end) + 'T00:00:00');
    if (!isNaN(e0)) {
      const ePlus1 = new Date(e0.getTime() + 24 * 60 * 60 * 1000);
      range.$lt = ePlus1;
    }
  }
  return Object.keys(range).length ? range : undefined;
}

// ==============================
// WhatsApp session endpoints
// ==============================
router.get('/status', authenticateToken, async (_req, res) => {
  const state = getState();
  const c = getClient();
  const connected = state === 'CONNECTED';
  const phone = connected && c?.info?.wid?.user ? c.info.wid.user : null;
  return res.json({ connected, state, phone });
});

router.get('/qr', authenticateToken, async (_req, res) => {
  const state = getState();
  if (state === 'CONNECTED') return res.status(204).end();

  const b64 = getLastQr();
  if (!b64) {
    return res.status(404).json({ ok: false, message: 'QR belum tersedia' });
  }
  return res.json({ ok: true, qr: `data:image/png;base64,${b64}` });
});

router.post('/reset', authenticateToken, async (_req, res) => {
  try {
    await resetSession();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Failed to reset session' });
  }
});

// ==============================
// Message logs list
// ==============================
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 200);

    let { start, end, q, status, type, userId } = req.query;
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      if (!isNaN(s) && !isNaN(e) && s > e) {
        const tmp = start; start = end; end = tmp;
      }
    }

    const filter = {};
    if (!req.user?.role || req.user.role !== 'admin') {
      filter.user = req.user.id;
    } else if (userId) {
      filter.user = userId;
    }

    if (q) {
      filter.$or = [
        { to: new RegExp(q, 'i') },
        { name: new RegExp(q, 'i') },
        { message: new RegExp(q, 'i') },
        { error: new RegExp(q, 'i') },
      ];
    }

    if (status) filter.status = status;
    if (type) filter.type = type;

    const range = buildDateRange(start, end);
    if (range) filter.createdAt = range;

    const [items, total] = await Promise.all([
      MessageLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      MessageLog.countDocuments(filter),
    ]);

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    return res.json({ ok: true, page, pageSize, total, totalPages, items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch logs' });
  }
});

// ==============================
// Message log detail
// ==============================
router.get('/logs/:id', authenticateToken, async (req, res) => {
  try {
    const doc = await MessageLog.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ ok: false, message: 'Log tidak ditemukan' });

    if (!req.user?.role || req.user.role !== 'admin') {
      if (String(doc.user) !== String(req.user.id)) {
        return res.status(403).json({ ok: false, message: 'Forbidden' });
      }
    }

    return res.json({ ok: true, item: doc });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: 'Gagal mengambil detail log' });
  }
});

// ==============================
// Public Media Endpoint (bypass token)
// ==============================
// GET /api/wa/media/:id
router.get('/media/:id', async (req, res) => {
  try {
    const log = await MessageLog.findById(req.params.id).lean();
    if (!log) {
      return res.status(404).json({ ok: false, message: 'Media tidak ditemukan' });
    }

    let filePath = '';
    if (log.meta?.path) filePath = log.meta.path;
    else if (log.mediaPath) filePath = log.mediaPath;
    else if (log.meta?.file) filePath = log.meta.file;
    else if (log.mediaUrl && log.mediaUrl.startsWith('/uploads/')) filePath = log.mediaUrl;
    else if (log.filePath) filePath = log.filePath;

    if (!filePath) {
      return res.status(404).json({ ok: false, message: 'Path media tidak ditemukan' });
    }

    // Selalu ambil nama file, abaikan folder di DB
    const fileName = path.basename(filePath);

    // Pastikan ambil dari uploads/media (yang udah di-mount di Docker)
    const absolutePath = path.join(process.cwd(), 'uploads', 'media', fileName);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ ok: false, message: 'File tidak ada di server' });
    }

    res.sendFile(absolutePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, message: 'Gagal memuat media' });
  }
});

module.exports = router;
