// backend/routes/notificationRoutes.js
const router = require("express").Router();
const {
  verifyStaffUsersToken,
  requirePermission,
} = require("../middleware/rbac-middleware");

const {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  deleteNotificationsBulk,
} = require("../controllers/notificationController");

router.get(
  "/admin/notifications",
  verifyStaffUsersToken,
  requirePermission("notifications:read"),
  getNotifications,
);

router.post(
  "/admin/notifications/read",
  verifyStaffUsersToken,
  requirePermission("notifications:read"),
  markRead,
);

router.post(
  "/admin/notifications/read-all",
  verifyStaffUsersToken,
  requirePermission("notifications:read"),
  markAllRead,
);

router.delete(
  "/admin/notifications/:id",
  verifyStaffUsersToken,
  requirePermission("notifications:read"),
  deleteNotification,
);

router.post(
  "/admin/notifications/delete-bulk",
  verifyStaffUsersToken,
  requirePermission("notifications:read"),
  deleteNotificationsBulk,
);

module.exports = router;
