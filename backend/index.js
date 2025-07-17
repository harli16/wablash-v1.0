const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoute = require('./routes/auth');
const userRoute = require('./routes/users');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Koneksi ke MongoDB (baca dari env atau default ke localhost)
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/wablastdb';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.log('MongoDB connection error:', err));

// =========== SEED ADMIN DEFAULT OTOMATIS ==========
const User = require('./models/User');
mongoose.connection.once('open', async () => {
  try {
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      const bcrypt = require('bcryptjs');
      const hashed = await bcrypt.hash('admin123', 10);
      await User.create({
        username: 'admin',
        password: hashed,
        role: 'admin'
      });
      console.log('User admin default berhasil dibuat: username=admin, password=admin123');
    }
  } catch (err) {
    console.log('Gagal membuat admin default:', err);
  }
});
// ===================================================

app.use('/api/auth', authRoute);
app.use('/api/users', userRoute);

app.get('/', (req, res) => {
  res.send('WABLASH BACKEND');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
