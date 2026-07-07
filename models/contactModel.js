const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  inquiryType: {
    type: String,
    enum: ["general", "support", "business", "feedback"],
    default: "general",
  },
  status: {
    type: String,
    enum: ["new", "read", "replied", "resolved"],
    default: "new",
  },
  ipAddress: {
    type: String,
    default: "",
  },
  userAgent: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  repliedAt: {
    type: Date,
  },
});

module.exports = mongoose.model("Contact" , contactSchema)


