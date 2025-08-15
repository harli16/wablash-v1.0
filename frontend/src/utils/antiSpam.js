// frontend/src/utils/antiSpam.js

const SPAMMY_WORDS = [
  'gratis', 'free', 'hadiah', 'giveaway', 'klik link', 'click here',
  'pinjaman', 'kredit', 'cepat cair', 'tanpa dp', 'tanpa jaminan'
];
const SHORTLINK_HOSTS = ['bit.ly','tinyurl.com','s.id','linktr.ee','goo.gl','cutt.ly'];

export function analyzeCaption(text) {
  const t = (text || '').trim();
  const warnings = [];
  if (!t) return { ok: true, warnings };

  const urls = t.match(/https?:\/\/[^\s)]+/gi) || [];
  if (urls.length > 2) warnings.push('Terlalu banyak link (maks 2).');
  if (urls.some(u => SHORTLINK_HOSTS.some(h => u.includes(h))))
    warnings.push('Hindari shortlink.');

  const letters = t.replace(/[^a-zA-Z]/g, '');
  const upper = letters.replace(/[^A-Z]/g, '').length;
  if (letters.length >= 10 && upper / letters.length > 0.4) warnings.push('Terlalu banyak HURUF BESAR.');

  const exclam = (t.match(/!/g) || []).length;
  if (exclam > 3) warnings.push('Terlalu banyak tanda seru.');

  const low = t.toLowerCase();
  const bad = SPAMMY_WORDS.filter(w => low.includes(w));
  if (bad.length) warnings.push(`Hindari kata: ${bad.join(', ')}.`);

  return { ok: warnings.length === 0, warnings };
}

export function spinSynonyms(text) {
  return text.replace(/\{([^{}]+)\}/g, (_, group) => {
    const parts = group.split('|').map(s => s.trim()).filter(Boolean);
    return parts.length ? parts[Math.floor(Math.random() * parts.length)] : '';
  });
}

export function withJitter(baseMs, pct = 0.3) {
  const j = Math.max(0, Math.min(0.9, pct));
  const delta = (Math.random() * 2 * j - j) * baseMs;
  return Math.max(0, Math.round(baseMs + delta));
}
