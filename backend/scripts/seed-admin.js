// backend/scripts/seed-admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/wablash';

const User = require('../models/User'); // Pastikan model ini benar path-nya

(async () => {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });

    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const role = process.env.ADMIN_ROLE || 'admin';

    let user = await User.findOne({ username });
    if (user) {
      console.log(`[seed-admin] User "${username}" sudah ada. Update password & role...`);
      user.password = await bcrypt.hash(password, 10);
      user.role = role;
      await user.save();
    } else {
      console.log(`[seed-admin] Membuat user "${username}"...`);
      const hash = await bcrypt.hash(password, 10);
      user = await User.create({ username, password: hash, role });
    }

    console.log('[seed-admin] OK:', { id: user._id.toString(), username: user.username, role: user.role });
  } catch (e) {
    console.error('[seed-admin] ERROR:', e);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
