const express = require("express");
const jwt = require("jsonwebtoken");
const {
  getUsersWishlist,
  addItemToWishlist,
  removeItemFromWishlist,
  clearEntireWishlist,
  checkIfItemIsInWishlist,
  getWishlistSummary,
  syncWishlist,
  moveItemsFromWishlistToCart,
  getWishlistAnalyticsForAdmin,
} = require("../controllers/wishlistController");
const { verifyStaffUsersToken, requirePermission } = require("../middleware/rbac-middleware");
const router = express.Router();

// ─── JWT Middleware ───────────────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ success: false, message: "No token provided." });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid token." });
  }
};

// Get user's wishlist
router.get("/wishlist/:userId", getUsersWishlist);

// Add item to wishlist
router.post("/wishlist/add", addItemToWishlist);

// Remove item from wishlist
router.delete("/wishlist/remove", removeItemFromWishlist);

// Clear entire wishlist
router.delete("/wishlist/clear/:userId", clearEntireWishlist);

// Check if item is in wishlist
router.get("/wishlist/check/:userId/:productId", checkIfItemIsInWishlist);

// Get wishlist summary (for header badge)
router.get("/wishlist/summary/:userId", getWishlistSummary);

// Sync wishlist from localStorage to backend (for when user logs in)
router.post("/wishlist/sync", verifyToken, syncWishlist);

// Move items from wishlist to cart
router.post("/wishlist/move-to-cart", verifyToken, moveItemsFromWishlistToCart);

// Get wishlist analytics for admin
router.get("/admin/wishlist/analytics", verifyStaffUsersToken, requirePermission('wishlists:read') ,  getWishlistAnalyticsForAdmin);

module.exports = router;

