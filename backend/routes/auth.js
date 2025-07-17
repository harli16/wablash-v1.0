const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// LOGIN
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ message: 'Username tidak ditemukan' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: 'Password salah' });

  const token = jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    'secret_jwt_key',
    { expiresIn: '12h' }
  );
  res.json({ token, role: user.role, username: user.username });
});

module.exports = router;
