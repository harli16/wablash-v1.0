// routes/upload.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../uploads/media');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ts = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${ts}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const allowed = new Set(['image/jpeg','image/png','application/pdf']);
const fileFilter = (_, file, cb) => cb(null, allowed.has(file.mimetype));

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post('/media', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok:false, error:'Invalid file' });
  const { filename, mimetype, size, path: filepath, originalname } = req.file;
  const kind = mimetype === 'application/pdf' ? 'document' : 'image';

  res.json({
    ok: true,
    file: {
      kind,
      filename,
      path: filepath,
      mime: mimetype,
      size,
      originalName: originalname,
    }
  });
});

module.exports = router;
