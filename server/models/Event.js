const mongoose = require('mongoose');
const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: String,
  club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  venue: String,
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  capacity: { type: Number, default: 100 },
  poster: String,
  status: { type: String, enum: ['approved', 'cancelled'], default: 'approved' }
}, { timestamps: true });
module.exports = mongoose.model('Event', eventSchema);