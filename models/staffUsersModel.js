// models/User.js (update your existing model)
const mongoose = require('mongoose');

const StaffUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: {type : String , required : true}, // updated
  isProtected: { type: Boolean, default: false }, // protect this user (super admin)
  tokenVersion: { type: Number, default: 0 }, // bump on role change to invalidate tokens
  status: { type: String, enum: ['inactive','active'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.models.StaffUser || mongoose.model('StaffUser', StaffUserSchema);
