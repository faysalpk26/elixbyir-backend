const express = require("express");
const router = express.Router();

const {
  getUserOrders,
  cancelOrder,
  getOrderStats,
  getOrderById,
  createOrder,
} = require("../controllers/orderController");
const { verifyToken } = require("../middleware/authMiddleware");

// Create order
router.post("/order/create", createOrder);

// User orders (protected)
router.get("/orders", verifyToken, getUserOrders);

// Keep specific route before :orderId
router.get("/orders/stats/summary", verifyToken, getOrderStats);

// Single order details (protected)
router.get("/orders/:orderId", verifyToken, getOrderById);

// Cancel order (protected)
router.post("/orders/:orderId/cancel", verifyToken, cancelOrder);

module.exports = router;
