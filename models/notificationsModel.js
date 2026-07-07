// backend/models/notificationModel.js
const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // "order.created"
    title: { type: String, required: true },
    message: { type: String },

    severity: {
      type: String,
      enum: ["info", "high", "critical"],
      default: "info",
    },

    actor: {
      kind: { type: String, enum: ["staff", "user", "anonymous"], default: "anonymous" },
      id: String,
      email: String,
    },

    target: {
      kind: String, // "order", "product", "blog"
      id: String,
      label: String,
    },

    audience: {
      permissions: [String], // who receives it
    },

    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" }],
  },
  { timestamps: true }
);


NotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 }
);


module.exports = mongoose.model("Notification", NotificationSchema);
