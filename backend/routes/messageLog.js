// backend/routes/messageLog.js
const express = require('express');
const router = express.Router();
const MessageLog = require('../models/MessageLog');
const { authenticateToken } = require('../middleware/auth');

// === Buat log baru (manual / dipanggil dari flow kirim) ===
router.post('/log', authenticateToken, async (req, res) => {
  try {
    const {
      number,
      name,              // NAMA PENERIMA
      message,
      status,            // 'success' | 'failed' | 'sent' (opsional)
      mediaType,         // 'text' | 'image' | 'document' (opsional)
      ok,                // boolean (opsional)
      error,             // string (opsional)
      id,                // message id dari WA (opsional)

      // === Tambahan 5 field baru ===
      asalSekolah,
      kelas,
      tahunLulusan,
      tanggalLahir,
      kodeBeasiswa
    } = req.body;

    const doc = await MessageLog.create({
      user: req.user.id,
      number,
      name: name || '',
      message: message ?? '(media only)',
      status: status || (typeof ok === 'boolean'
        ? (ok ? 'success' : 'failed')
        : 'sent'),
      ok: typeof ok === 'boolean' ? ok : undefined,
      mediaType: mediaType || 'text',
      error: error || null,
      id: id || null,

      // Simpan field tambahan
      asalSekolah: asalSekolah || '',
      kelas: kelas || '',
      tahunLulusan: tahunLulusan || '',
      tanggalLahir: tanggalLahir || '',
      kodeBeasiswa: kodeBeasiswa || ''
    });

    res.json(doc);
  } catch (err) {
    res.status(400).json({
      message: 'Log gagal disimpan',
      error: err.message
    });
  }
});

// === Ambil log (admin lihat semua, staff hanya miliknya sendiri) ===
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    let logs;
    if (req.user.role === 'admin') {
      logs = await MessageLog.find()
        .populate('user', 'username role')
        .sort({ createdAt: -1 });
    } else {
      logs = await MessageLog.find({ user: req.user.id })
        .sort({ createdAt: -1 });
    }
    res.json(logs);
  } catch (err) {
    res.status(400).json({
      message: 'Gagal ambil log',
      error: err.message
    });
  }
});

module.exports = router;
