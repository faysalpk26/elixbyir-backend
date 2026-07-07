const express = require('express');
const router = express.Router();
const { subscribeNewsletter, unsubscribeNewsletter, getNewsletterStats, getAllNewsletterSubscribers, newsletterPreferences } = require('../controllers/newsletterController');
const {verifyToken} = require("../middleware/authMiddleware")

router.post('/newsletter/subscribe', subscribeNewsletter );

// Newsletter unsubscribe endpoint
router.post('/newsletter/unsubscribe',unsubscribeNewsletter );

// Get newsletter statistics (admin endpoint)
router.get('/newsletter/stats',  getNewsletterStats );

// Get all subscribers (admin endpoint)
router.get('/newsletter/subscribers', getAllNewsletterSubscribers );

// Newsletter preferences update endpoint
router.put('/newsletter/preferences', newsletterPreferences );


// Test endpoint to verify orders system is working
// router.get('/test/orders', async (req, res) => {
//     try {
//         const orderCount = await Order.countDocuments();
        
//         // Get a sample order to show structure
//         const sampleOrder = await Order.findOne().lean();
        
//         res.json({
//             success: true,
//             message: 'Orders API is working',
//             totalOrders: orderCount,
//             sampleOrderStructure: sampleOrder ? {
//                 id: sampleOrder._id,
//                 orderId: sampleOrder.orderId,
//                 userId: sampleOrder.userId,
//                 status: sampleOrder.status,
//                 createdAt: sampleOrder.createdAt,
//                 hasItems: Array.isArray(sampleOrder.items),
//                 itemCount: sampleOrder.items ? sampleOrder.items.length : 0,
//                 hasShippingAddress: !!sampleOrder.shippingAddress,
//                 paymentMethod: sampleOrder.paymentMethod
//             } : 'No orders found'
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             error: error.message
//         });
//     }
// });

module.exports = router;