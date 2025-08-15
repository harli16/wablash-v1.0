// middleware/auth.js
const jwt = require('jsonwebtoken');

// Ambil secret dari ENV, fallback ke default lama agar tidak langsung putus
const JWT_SECRET = process.env.JWT_SECRET || 'secret_jwt_key';

// Middleware untuk cek token JWT di header Authorization: Bearer <token>
function authenticateToken(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Token tidak ditemukan' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    // Konsisten pakai 401 agar FE bisa auto-logout
    return res.status(401).json({ ok: false, message: 'Token tidak valid' });
  }
}

// Middleware cek role
function authorizeRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      // 403 untuk forbidden (punya token tapi role tidak cocok)
      return res.status(403).json({ ok: false, message: 'Akses hanya untuk ' + role });
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRole };
