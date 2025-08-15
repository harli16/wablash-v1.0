// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secret_jwt_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

// Helper: buat JWT
function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const usernameOrEmail = (req.body?.username || '').trim();
    const password = req.body?.password || '';

    if (!usernameOrEmail || !password) {
      return res.status(400).json({
        ok: false,
        code: 'MISSING_FIELDS',
        message: 'username/email & password required'
      });
    }

    // Cari berdasarkan username atau email (case-insensitive)
    const user = await User.findOne({
      $or: [
        { username: { $regex: new RegExp(`^${usernameOrEmail}$`, 'i') } },
        { email: { $regex: new RegExp(`^${usernameOrEmail}$`, 'i') } }
      ]
    }).select('+passwordHash');

    if (!user) {
      console.error('[AUTH] User tidak ditemukan:', usernameOrEmail);
      return res.status(401).json({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Username atau password salah'
      });
    }

    if (!user.passwordHash) {
      console.error('[AUTH] User ditemukan tapi passwordHash kosong:', user.username);
      return res.status(401).json({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Username atau password salah'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      console.error('[AUTH] Password mismatch untuk user:', user.username);
      return res.status(401).json({
        ok: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Username atau password salah'
      });
    }

    const token = signToken(user);
    return res.json({
      ok: true,
      token,
      user: {
        id: String(user._id),
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    console.error('[AUTH] Login error:', err);
    return res.status(500).json({
      ok: false,
      code: 'LOGIN_ERROR',
      message: 'Login error'
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.sub).select('_id username role');
    if (!user) {
      return res.status(404).json({
        ok: false,
        code: 'USER_NOT_FOUND',
        message: 'User tidak ditemukan'
      });
    }
    return res.json({
      ok: true,
      user: {
        id: String(user._id),
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error('[AUTH] Me error:', err);
    return res.status(500).json({
      ok: false,
      code: 'ME_ERROR',
      message: 'Gagal mengambil profil'
    });
  }
});

module.exports = router;
