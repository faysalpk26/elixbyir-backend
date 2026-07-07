// models/Role.js
const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, 
  permissions: [{ type: String }],
  description: { type: String },
  active: { type: Boolean, default: true },

  protected: { type: Boolean, default: false }, // true for super_admin role
}, { timestamps: true });

module.exports = mongoose.models.Role || mongoose.model('Role', RoleSchema);
