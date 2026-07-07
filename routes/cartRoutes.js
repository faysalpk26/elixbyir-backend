const express = require('express');
const router = express.Router();
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const { getCart, addToCart, updateCartItem, removeFromCart, clearCart, syncCart, getCartSummary } = require('../controllers/cartController');


// Get user's cart (enhanced with better performance)
router.get('/cart/:userId', getCart);

// Add item to cart (enhanced with better validation)
router.post('/cart/add', addToCart);

// Update item quantity in cart (enhanced)
router.put('/cart/update', updateCartItem);

// Remove item from cart (unchanged)
router.delete('/cart/remove', removeFromCart);

// Clear entire cart (enhanced with better response)
router.delete('/cart/clear/:userId', clearCart);

// Enhanced sync cart from sessionStorage to backend (for when user logs in)
router.post('/cart/sync', syncCart);

// Get cart summary (for header badge) - enhanced
router.get('/cart/summary/:userId', getCartSummary);




module.exports = router;