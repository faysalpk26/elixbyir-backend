const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getCart, addToCart, updateCartItem, removeFromCart, clearCart, syncCart, getCartSummary } = require('../controllers/cartController');

// ─── JWT Middleware ───────────────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, message: 'No token provided.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

// Get user's cart
router.get('/cart/:userId', getCart);

// Add item to cart
router.post('/cart/add', addToCart);

// Update item quantity in cart
router.put('/cart/update', updateCartItem);

// Remove item from cart
router.delete('/cart/remove', removeFromCart);

// Clear entire cart
router.delete('/cart/clear/:userId', clearCart);

// Sync guest cart to backend on login
router.post('/cart/sync', verifyToken, syncCart);

// Get cart summary (for header badge)
router.get('/cart/summary/:userId', getCartSummary);

module.exports = router;