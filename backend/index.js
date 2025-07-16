const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { create } = require('venom-bot');

const app = express();
app.use(cors());
app.use(bodyParser.json());

let client = null;

create({
  session: 'wablash-session',
  headless: true,
  browserArgs: ['--no-sandbox'],
  executablePath: '/usr/bin/chromium-browser'
})
  .then((venom) => {
    client = venom;
    console.log('✅ WhatsApp ready');
  })
  .catch((err) => {
    console.error('❌ Failed to start venom-bot', err);
  });

app.post('/send', async (req, res) => {
  const { number, message } = req.body;
  if (!client) return res.status(503).send('WhatsApp not ready');

  try {
    await client.sendText(`${number}@c.us`, message);
    res.send({ success: true });
  } catch (e) {
    res.status(500).send({ success: false, error: e.message });
  }
});

app.listen(3001, () => {
  console.log('🚀 Backend API running on http://localhost:3001');
});
