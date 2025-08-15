// backend/models/MessageLog.js
const mongoose = require('mongoose');

const MessageLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    // nomor tujuan — data lama pakai "to"
    to: { type: String, required: false, index: true },

    // nama penerima
    name: { type: String, default: '' },

    // isi pesan (text) atau caption (media)
    message: { type: String, required: false },

    // jenis pesan (tetap lowercase sesuai kode kamu)
    type: { type: String, enum: ['text', 'image', 'document'], default: 'text' },

    // status kirim (tetap sesuai kode kamu)
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'success'],
      default: 'sent',
      index: true
    },

    // flag keberhasilan eksplisit (opsional)
    ok: { type: Boolean, default: undefined },

    // pesan error (jika ada)
    error: { type: String },

    // id pesan dari provider (WhatsApp / gateway)
    id: { type: String },

    // metadata bebas
    meta: { type: Object },

    // === Tambahan field baru ===
    asalSekolah: { type: String, default: '' },
    kelas: { type: String, default: '' },
    tahunLulusan: { type: String, default: '' },
    tanggalLahir: { type: String, default: '' }, // bisa diganti type: Date kalau mau validasi tanggal
    kodeBeasiswa: { type: String, default: '' }
  },
  {
    timestamps: true,            // --> createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/**
 * Virtuals untuk kompatibilitas FE:
 * - number  <-> to
 * - mediaType <-> type
 */
MessageLogSchema.virtual('number')
  .get(function () { return this.to; })
  .set(function (v) { this.to = v; });

MessageLogSchema.virtual('mediaType')
  .get(function () { return this.type; })
  .set(function (v) { this.type = v; });

/**
 * Normalisasi otomatis 'ok' bila tidak di-set:
 * - sent/success  => ok: true
 * - failed        => ok: false
 */
MessageLogSchema.pre('save', function (next) {
  if (typeof this.ok !== 'boolean') {
    if (this.status === 'sent' || this.status === 'success') this.ok = true;
    else if (this.status === 'failed') this.ok = false;
  }
  next();
});

/**
 * Index untuk percepat filter tanggal & list per user/nomor.
 * Aman ditambahkan kapan pun; Mongo akan membangun di background.
 */
MessageLogSchema.index({ createdAt: -1 });
MessageLogSchema.index({ user: 1, createdAt: -1 });
MessageLogSchema.index({ to: 1, createdAt: -1 });

/**
 * Query helper: filter rentang tanggal inklusif.
 * Pemakaian:
 *   MessageLog.find({...}).inDateRange(start, end)
 * Format start/end: 'YYYY-MM-DD' atau Date.
 */
MessageLogSchema.query.inDateRange = function (start, end) {
  if (!start && !end) return this;

  const range = {};
  if (start) {
    const s = start instanceof Date ? start : new Date(String(start) + 'T00:00:00');
    if (!isNaN(s)) range.$gte = s;
  }
  if (end) {
    // inklusif sampai 23:59:59.999 => pakai < (end + 1 hari)
    const e0 = end instanceof Date ? end : new Date(String(end) + 'T00:00:00');
    if (!isNaN(e0)) {
      const ePlus1 = new Date(e0.getTime() + 24 * 60 * 60 * 1000);
      range.$lt = ePlus1;
    }
  }

  if (Object.keys(range).length) {
    this.where({ createdAt: range });
  }
  return this;
};

module.exports = mongoose.model('MessageLog', MessageLogSchema);
