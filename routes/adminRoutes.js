const express = require("express");
const router = express.Router();
const Admin = require("../models/adminModel");
const Order = require("../models/orderModel");
const { sendOrderStatusEmail } = require("../utils/emailService");
const {
  getAllOrders,
  getOrderStats,
  getOrdersReport,
  bulkUpdateOrderStatus,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  adminLogin,
  adminProfile,
  adminLogout,
  adminRetryFailEmails,
  deleteAllOrders,
  fixImageUrls,
  verifyBankTransferPayment,
} = require("../controllers/adminController");
const {
  staffUserLogin,
  staffUserProfile,
  staffUserLogout,
} = require("../controllers/staffUserController");
const {
  verifyStaffUsersToken,
  requirePermission,
} = require("../middleware/rbac-middleware");
const { deleteOrderBulk } = require("../controllers/orderController");

// Admin: Get all orders with pagination, filtering, and search
router.get(
  "/admin/orders",
  verifyStaffUsersToken,
  requirePermission("orders:read"),
  getAllOrders,
);

// IMPORTANT: Stats route MUST come BEFORE the /:orderId route
// Admin: Get order statistics
router.get(
  "/admin/orders/stats",
  verifyStaffUsersToken,
  requirePermission("orders:read"),
  getOrderStats,
);

// Admin: Get orders by date range (for reports) - MUST come before /:orderId
router.get(
  "/admin/orders/report",
  verifyStaffUsersToken,
  requirePermission("orders:read"),
  getOrdersReport,
);

// Admin: Bulk update order status - MUST come before /:orderId
router.patch(
  "/admin/orders/bulk-status",
  verifyStaffUsersToken,
  requirePermission("orders:update"),
  bulkUpdateOrderStatus,
);

// Admin: Get single order details by ID - MUST come AFTER specific routes
router.get(
  "/admin/orders/:orderId",
  verifyStaffUsersToken,
  requirePermission("orders:read"),
  getOrderById,
);

// Admin: Update order status - MUST come AFTER the GET route
router.patch(
  "/admin/orders/:orderId/status",
  verifyStaffUsersToken,
  requirePermission("orders:update"),
  updateOrderStatus,
);

// Admin: Delete order (use with caution) - MUST come AFTER other routes
router.delete(
  "/admin/orders/:orderId",
  verifyStaffUsersToken,
  requirePermission("orders:delete"),
  deleteOrder,
);

// Admin: Delete ALL orders (use with EXTREME caution)
router.delete(
  "/admin/orders/delete-all/confirm",
  verifyStaffUsersToken,
  requirePermission("orders:delete"),
  deleteAllOrders,
);

// Delete bulk orders
router.post(
  "/admin/orders/bulk-delete",
  verifyStaffUsersToken,
  requirePermission("orders:delete"),
  deleteOrderBulk,
);

// Admin Login
router.post("/admin/login", staffUserLogin);

// Get admin profile
router.get("/admin/profile", verifyStaffUsersToken, staffUserProfile);

// Admin logout
router.post("/admin/logout", verifyStaffUsersToken, staffUserLogout);

// Add a separate endpoint to retry failed emails
router.post(
  "/admin/retry-email/:orderId",
  verifyStaffUsersToken,
  requirePermission("orders:update"),
  adminRetryFailEmails,
);

router.post(
  "/fix-image-urls",
  verifyStaffUsersToken,
  requirePermission("products:update"),
  fixImageUrls,
);

router.patch(
  "/admin/orders/:orderId/verify-bank-transfer",
  verifyStaffUsersToken,
  requirePermission("orders:update"),
  verifyBankTransferPayment,
);


module.exports = router;
