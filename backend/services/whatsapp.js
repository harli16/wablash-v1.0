// services/whatsapp.js
// Implementasi whatsapp-web.js dengan cache QR base64 dan state tracking.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const qrcode = require('qrcode'); // menghasilkan dataURL/base64
const { Client, LocalAuth } = require('whatsapp-web.js');

const TOKENS_DIR = process.env.TOKENS_DIR || path.join(__dirname, '..', 'tokens');
// JANGAN paksa default ke /usr/bin/chromium; biarkan kosong jika tidak diset di ENV
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '';

let client = null;
let initPromise = null;
let resetting = false;

let lastQrBase64 = '';   // simpan base64 (tanpa prefix "data:image/png;base64,")
let lastQrAt = 0;        // timestamp QR terakhir
let currentState = 'DISCONNECTED';

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function emptyDir(dir) {
  await ensureDir(dir);
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(e => fsp.rm(path.join(dir, e.name), { recursive: true, force: true }))
  );
}

async function stopClient() {
  if (!client) return;
  try { await client.destroy(); } catch (_) {}
  client = null;
  initPromise = null;
  currentState = 'DISCONNECTED';
}

// ====== Public getters ======
function getClient() { return client; }
function getState() { return currentState; }

/** Mengembalikan base64 QR (tanpa prefix) bila masih valid, selain itu null. */
function getLastQr() {
  // anggap QR valid 5 menit
  if (!lastQrBase64) return null;
  if (Date.now() - lastQrAt > 5 * 60 * 1000) {
    lastQrBase64 = '';
    return null;
  }
  return lastQrBase64;
}

// ====== Init & Reset ======
async function initClient() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await ensureDir(TOKENS_DIR);

    // Susun opsi Puppeteer — executablePath hanya dipakai jika ENV diset
    const puppeteerOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--lang=en-US,en',
      ],
    };
    if (CHROMIUM_PATH) {
      puppeteerOptions.executablePath = CHROMIUM_PATH;
      console.log('[WA] Using Chromium at', CHROMIUM_PATH);
    } else {
      console.log('[WA] Using bundled Chromium from puppeteer (no CHROMIUM_PATH set)');
    }

    client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'wablash',
        dataPath: TOKENS_DIR, // simpan sesi di /app/tokens
      }),
      puppeteer: puppeteerOptions,
      takeoverOnConflict: true,
      takeoverTimeoutMs: 0,
    });

    currentState = 'INITIALIZING';

    // Event handlers
    client.on('qr', async (qr) => {
      try {
        const dataUrl = await qrcode.toDataURL(qr, { errorCorrectionLevel: 'M' });
        lastQrBase64 = (dataUrl.split(',')[1]) || ''; // simpan hanya base64
        lastQrAt = Date.now();
        currentState = 'SCAN_QR';
        console.log('[WA] QR updated (base64 length:', lastQrBase64.length, ')');
      } catch (e) {
        console.error('[WA] Generate QR failed:', e?.message || e);
      }
    });

    client.on('loading_screen', () => { currentState = 'CONNECTING'; });
    client.on('authenticated', () => {
      currentState = 'AUTHENTICATED';
      lastQrBase64 = '';
      console.log('[WA] Authenticated');
    });
    client.on('ready', () => {
      currentState = 'CONNECTED';
      lastQrBase64 = '';
      console.log('[WA] Client ready.');
    });
    client.on('auth_failure', (m) => {
      currentState = 'DISCONNECTED';
      console.error('[WA] Auth failure:', m);
    });
    client.on('disconnected', (reason) => {
      currentState = 'DISCONNECTED';
      console.warn('[WA] Disconnected:', reason);
      // Setelah putus, QR baru akan muncul saat init ulang atau saat lib memicu event qr lagi
    });

    try {
      await client.initialize();
    } catch (e) {
      // Log rinci masalah Chromium supaya gampang diagnosa
      console.error('[WA] Puppeteer initialize error:', e?.message || e);
      if (/Failed to launch/gi.test(String(e?.message))) {
        console.error('[WA] Hint: Pastikan dependency Chromium tersedia di image, atau set CHROMIUM_PATH dengan benar.');
      }
      throw e;
    }

    // Kompat: beberapa kode lama pakai sendText
    if (!client.sendText) {
      client.sendText = async (jid, message) => client.sendMessage(jid, message);
    }

    return client;
  })().catch((e) => {
    currentState = 'DISCONNECTED';
    console.error('[WA] init error (top-level):', e?.message || e);
    initPromise = null;
    throw e;
  });

  return initPromise;
}

async function resetSession() {
  if (resetting) throw new Error('Reset sedang berlangsung');
  resetting = true;
  try {
    console.log('[WA] Reset: stopping client & clearing tokens at', TOKENS_DIR);
    await stopClient();
    await emptyDir(TOKENS_DIR);
    lastQrBase64 = '';
    lastQrAt = 0;
    currentState = 'INITIALIZING';
    await initClient(); // re-init supaya QR baru cepat tersedia
    return true;
  } catch (e) {
    console.error('[WA] resetSession error:', e?.message || e);
    throw e;
  } finally {
    resetting = false;
  }
}

module.exports = {
  initClient,
  getClient,
  getState,
  getLastQr,
  resetSession,
};
