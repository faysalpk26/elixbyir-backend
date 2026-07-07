// routes/admin.js
const express = require("express");
const roleCtrl = require("../controllers/roleController");
const {
  verifyStaffUsersToken,
  requirePermission,
} = require("../middleware/rbac-middleware");

const router = express.Router();

// Role routes (role management requires roles:manage OR super_admin)
router.post(
  "/roles",
  verifyStaffUsersToken,
  requirePermission("roles:create"),
  roleCtrl.createRole,
);
router.get(
  "/roles",
  verifyStaffUsersToken,
  requirePermission("roles:read"),
  roleCtrl.listRoles,
);
router.get(
  "/roles/:id",
  verifyStaffUsersToken,
  requirePermission("roles:read"),
  roleCtrl.getRole,
);
router.put(
  "/roles/:id",
  verifyStaffUsersToken,
  requirePermission("roles:update"),
  roleCtrl.updateRole,
);
router.delete(
  "/roles/:id",
  verifyStaffUsersToken,
  requirePermission("roles:delete"),
  roleCtrl.deleteRole,
);
router.patch(
  "/roles/:id/toggle-active",
  verifyStaffUsersToken,
  requirePermission("roles:update"),
  roleCtrl.toggleActiveStatus,
);

module.exports = router;
