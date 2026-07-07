const express = require('express');
const router = express.Router();
const { stripe, paypalClient } = require('../config/payment');
const Order = require('../models/orderModel');
const { sendOrderConfirmationEmail } = require('../utils/emailService');
const { createPaymentIntent, confirmPayment, createPayPalOrder, capturePayPalOrder, testPayPal, createOfflineOrder, uploadBankTransferReceipt } = require('../controllers/paymentController');
const uploadMulterTemp = require("../utils/multerTemp");
const { verifyStaffUsersToken, requirePermission } = require("../middleware/rbac-middleware");

router.post('/payment/create-payment-intent',createPaymentIntent);

// Update your payment confirmation to use non-blocking email
router.post('/payment/confirm', confirmPayment);

// CREATE PAYPAL ORDER - This runs when user clicks PayPal button
router.post('/payment/paypal/create-order', createPayPalOrder);

// CAPTURE PAYPAL PAYMENT - This runs when PayPal payment is approved
router.post('/payment/paypal/capture-order', capturePayPalOrder);

// Test endpoint to verify PayPal connection
router.get(
  '/payment/paypal/test',
  verifyStaffUsersToken,
  requirePermission("settings:update"),
  testPayPal,
);

router.post('/payment/offline/create-order', createOfflineOrder);

router.post(
  "/payment/offline/upload-receipt/:orderId",
  uploadMulterTemp.single("receiptImage"),
  uploadBankTransferReceipt,
);


// New endpoint to update order status and send email

module.exports = router;
