const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  avatar: {
    type: String,
    default: "",
  },
  address: {
    type: String,
    default: "",
    trim: true,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
  // Add these OAuth fields:
  googleId: {
    type: String,
    sparse: true, // Allows multiple null values
  },
  facebookId: {
    type: String,
    sparse: true,
  },
  authProvider: {
    type: String,
    enum: ["local", "google", "facebook"],
    default: "local",
  },
});

module.exports = mongoose.model("User" , userSchema)


