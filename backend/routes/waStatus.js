const router = require('express').Router();
const { authenticateToken } = require('../middleware/auth');
const { getClient } = require('../services/whatsapp');

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const client = await getClient();
    let state = 'UNKNOWN';
    try {
      state = await client.getState();
    } catch (e) {
      console.warn('[WA] getState() error:', e.message);
    }
    res.json({
      ok: true,
      state,
      ready: state === 'CONNECTED' || state === 'READY'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

module.exports = router;
