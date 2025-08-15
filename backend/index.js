// backend/index.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const { initClient } = require('./services/whatsapp'); // <-- WA init di-startup

const app = express();

// ===== ENV =====
const PORT = Number(process.env.PORT) || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/wablash';

// ===== MIDDLEWARE =====
app.use(
  cors({
    // Untuk dev/Docker: FE di 3006 (container), 3000 (dev), dan 8080 (Nginx)
    origin: [
      'http://localhost:3006',
      'http://127.0.0.1:3006',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== ROUTES: AUTH =====
try {
  const authRoutes = require('./routes/auth'); // harus expose POST /login
  app.use('/api/auth', authRoutes);
} catch (e) {
  console.warn(
    '[WARN] routes/auth tidak ditemukan. Login akan gagal sampai file dibuat.'
  );
}

// ===== ROUTES: MESSAGE =====
const messageSend = require('./routes/messageSend');   // text (single & batch)
const messageMedia = require('./routes/messageMedia'); // image & document

// Kompatibilitas route lama tanpa prefix
app.use(messageSend);
app.use(messageMedia);

// Prefix resmi: /api/message
app.use('/api/message', messageSend);
app.use('/api/message', messageMedia);

// ===== ROUTES: MESSAGE LOGS =====
// -> ini yang bikin GET /api/message/logs & POST /api/message/log aktif
try {
  const messageLogRoutes = require('./routes/messageLog'); // <— sesuai nama file kamu
  app.use('/api/message', messageLogRoutes);
} catch (e) {
  console.warn('[WARN] routes/messageLog tidak ditemukan:', e?.message || e);
}

// ===== ROUTES: WA (STATUS/QR/RESET) =====
const waRoutes = require('./routes/wa');
app.use('/api/wa', waRoutes); // /status, /qr, /reset

// ===== HEALTH =====
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ===== ERROR HANDLER (LAST) =====
app.use((err, req, res, next) => {
  console.error('[HTTP ERROR]', err);
  if (res.headersSent) return next(err);
  res
    .status(500)
    .json({ ok: false, code: 'INTERNAL_ERROR', message: err?.message || 'Error' });
});

// ===== DB CONNECT & START =====
(async () => {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('[DB] MongoDB connected!');

    app.listen(PORT, '0.0.0.0', async () => {
      console.log(`[BE] Server running at http://0.0.0.0:${PORT}`);
      console.log('[BE] JWT_SECRET set?', Boolean(process.env.JWT_SECRET));

      // Init WhatsApp client setelah server hidup
      try {
        await initClient();
        console.log('[WA] initClient started.');
      } catch (e) {
        console.error('[WA] initClient failed:', e?.message || e);
      }
    });
  } catch (err) {
    console.error('[DB] Mongo connect error:', err);
    process.exit(1);
  }
})();

// ===== SAFETY NETS =====
process.on('unhandledRejection', (e) =>
  console.error('UNHANDLED REJECTION', e)
);
process.on('uncaughtException', (e) =>
  console.error('UNCAUGHT EXCEPTION', e)
);
