const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// CREATE USER (admin only)
router.post('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { username, password, role } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    const newUser = new User({ username, password: hashed, role });
    await newUser.save();
    res.json({ message: 'User berhasil dibuat' });
  } catch (e) {
    res.status(400).json({ message: 'Username sudah digunakan' });
  }
});

// LIST USER (admin only)
router.get('/', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const users = await User.find({}, '-password');
  res.json(users);
});

// EDIT USER (admin only)
router.put('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  const { username, password, role } = req.body;
  const update = { username, role };
  if (password) {
    update.password = await bcrypt.hash(password, 10);
  }
  try {
    await User.findByIdAndUpdate(req.params.id, update);
    res.json({ message: 'User berhasil diupdate' });
  } catch (e) {
    res.status(400).json({ message: 'Update gagal' });
  }
});

// DELETE USER (admin only)
router.delete('/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User berhasil dihapus' });
  } catch (e) {
    res.status(400).json({ message: 'Hapus gagal' });
  }
});

module.exports = router;
