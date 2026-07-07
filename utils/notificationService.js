// backend/services/notificationService.js
const Notification = require("../models/notificationsModel");
const { getIO } = require("../config/socket");

async function createNotification(payload) {
  const doc = await Notification.create(payload);

  const io = getIO();
  const perms = payload.audience?.permissions || [];

  
  perms.forEach((p) => {
    io.to(`perm:${p}`).emit("notification:new", doc);
  });

  return doc;
}

module.exports = { createNotification };
