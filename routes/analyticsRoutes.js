const Sale = require("../models/saleModel");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const express = require('express');
const router = express.Router();
const { verifyStaffUsersToken, requirePermission } = require("../middleware/rbac-middleware");
const protectDashboard = [verifyStaffUsersToken, requirePermission("products:read")];
const protectAnalytics = [verifyStaffUsersToken, requirePermission("analytics:read")];

router.get('/dashboard/stats', ...protectDashboard, async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const activeProducts = await Product.countDocuments({ available: true });
        const inactiveProducts = await Product.countDocuments({ available: false });
        const publishedProducts = await Product.countDocuments({ status: 'published' });
        const draftProducts = await Product.countDocuments({ status: 'draft' });
        const featuredProducts = await Product.countDocuments({ featured: true });
        const lowStockProducts = await Product.countDocuments({ 
            $expr: { $lte: ['$stock_quantity', '$low_stock_threshold'] }
        });
        
        const categoryStats = await Product.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        const brandStats = await Product.aggregate([
            { $match: { brand: { $ne: '' } } },
            { $group: { _id: '$brand', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        const recentProducts = await Product.find({})
            .sort({ date: -1 })
            .limit(5);

        res.json({
            success: true,
            stats: {
                totalProducts,
                activeProducts,
                inactiveProducts,
                publishedProducts,
                draftProducts,
                featuredProducts,
                lowStockProducts,
                categoryStats,
                brandStats,
                recentProducts
            }
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
})

// API to simulate a sale (for testing analytics)
router.post('/simulate-sale', ...protectAnalytics, async (req, res) => {
    try {
        if (process.env.NODE_ENV === "production") {
            return res.status(404).json({
                success: false,
                message: "Not found",
            });
        }

        const { product_id, quantity = 1 } = req.body;
        
        const product = await Product.findOne({ id: product_id });
        if (!product) {
            return res.json({ success: false, message: "Product not found" });
        }

        const saleDate = new Date();
        const total_amount = product.new_price * quantity;

        const sale = new Sale({
            product_id: product.id,
            product_name: product.name,
            category: product.category,
            price: product.new_price,
            quantity: quantity,
            total_amount: total_amount,
            date: saleDate,
            month: saleDate.getMonth() + 1,
            year: saleDate.getFullYear()
        });

        await sale.save();

        // Update product sales count and reduce stock
        await Product.findOneAndUpdate(
            { id: product_id },
            { 
                $inc: { 
                    sales_count: quantity,
                    stock_quantity: -quantity 
                }
            }
        );

        res.json({
            success: true,
            message: "Sale recorded successfully",
            sale: sale
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Analytics API - Sales Overview
router.get('/analytics/sales-overview', ...protectAnalytics, async (req, res) => {
    try {
        const { period = 'monthly', year = new Date().getFullYear() } = req.query;
        
        let groupBy, sortBy;
        let matchConditions = { year: parseInt(year) };

        if (period === 'daily') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            matchConditions = { date: { $gte: thirtyDaysAgo } };
            
            groupBy = {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                    total_sales: { $sum: "$total_amount" },
                    total_orders: { $sum: 1 },
                    total_quantity: { $sum: "$quantity" }
                }
            };
            sortBy = { $sort: { "_id": 1 } };
        } else if (period === 'weekly') {
            const twelveWeeksAgo = new Date();
            twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
            matchConditions = { date: { $gte: twelveWeeksAgo } };
            
            groupBy = {
                $group: {
                    _id: { 
                        week: { $week: "$date" },
                        year: { $year: "$date" }
                    },
                    total_sales: { $sum: "$total_amount" },
                    total_orders: { $sum: 1 },
                    total_quantity: { $sum: "$quantity" }
                }
            };
            sortBy = { $sort: { "_id.year": 1, "_id.week": 1 } };
        } else if (period === 'monthly') {
            groupBy = {
                $group: {
                    _id: "$month",
                    total_sales: { $sum: "$total_amount" },
                    total_orders: { $sum: 1 },
                    total_quantity: { $sum: "$quantity" }
                }
            };
            sortBy = { $sort: { "_id": 1 } };
        } else if (period === 'yearly') {
            matchConditions = {};
            groupBy = {
                $group: {
                    _id: "$year",
                    total_sales: { $sum: "$total_amount" },
                    total_orders: { $sum: 1 },
                    total_quantity: { $sum: "$quantity" }
                }
            };
            sortBy = { $sort: { "_id": 1 } };
        }

        const salesData = await Sale.aggregate([
            { $match: matchConditions },
            groupBy,
            sortBy
        ]);

        res.json({
            success: true,
            data: salesData,
            period: period,
            year: year
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Analytics API - Product Performance
router.get('/analytics/product-performance', ...protectAnalytics, async (req, res) => {
    try {
        const { month, year = new Date().getFullYear() } = req.query;
        
        let matchConditions = { year: parseInt(year) };
        if (month) {
            matchConditions.month = parseInt(month);
        }

        const productPerformance = await Sale.aggregate([
            { $match: matchConditions },
            {
                $group: {
                    _id: {
                        product_id: "$product_id",
                        product_name: "$product_name",
                        category: "$category"
                    },
                    total_sales: { $sum: "$total_amount" },
                    total_quantity: { $sum: "$quantity" },
                    total_orders: { $sum: 1 },
                    avg_price: { $avg: "$price" }
                }
            },
            { $sort: { total_sales: -1 } },
            { $limit: 20 }
        ]);

        const products = await Product.find({}, 'id name views sales_count');
        const productViews = {};
        products.forEach(product => {
            productViews[product.id] = {
                views: product.views || 0,
                sales_count: product.sales_count || 0
            };
        });

        const enhancedPerformance = productPerformance.map(item => ({
            ...item,
            views: productViews[item._id.product_id]?.views || 0,
            conversion_rate: productViews[item._id.product_id]?.views > 0 
                ? ((item.total_quantity / productViews[item._id.product_id].views) * 100).toFixed(2)
                : 0
        }));

        res.json({
            success: true,
            data: enhancedPerformance,
            month: month,
            year: year
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Analytics API - Category Performance
router.get('/analytics/category-performance', ...protectAnalytics, async (req, res) => {
    try {
        const { year = new Date().getFullYear() } = req.query;
        
        const categoryPerformance = await Sale.aggregate([
            { $match: { year: parseInt(year) } },
            {
                $group: {
                    _id: "$category",
                    total_sales: { $sum: "$total_amount" },
                    total_quantity: { $sum: "$quantity" },
                    total_orders: { $sum: 1 },
                    avg_order_value: { $avg: "$total_amount" }
                }
            },
            { $sort: { total_sales: -1 } }
        ]);

        res.json({
            success: true,
            data: categoryPerformance,
            year: year
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Analytics API - Revenue Metrics
router.get('/analytics/revenue-metrics', ...protectAnalytics, async (req, res) => {
    try {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        const todayStart = new Date(currentDate.setHours(0, 0, 0, 0));
        const todayEnd = new Date(currentDate.setHours(23, 59, 59, 999));
        
        const todayRevenue = await Sale.aggregate([
            { $match: { date: { $gte: todayStart, $lte: todayEnd } } },
            { $group: { _id: null, total: { $sum: "$total_amount" } } }
        ]);

        const monthRevenue = await Sale.aggregate([
            { $match: { year: currentYear, month: currentMonth } },
            { $group: { _id: null, total: { $sum: "$total_amount" } } }
        ]);

        const yearRevenue = await Sale.aggregate([
            { $match: { year: currentYear } },
            { $group: { _id: null, total: { $sum: "$total_amount" } } }
        ]);

        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        
        const lastMonthRevenue = await Sale.aggregate([
            { $match: { year: lastMonthYear, month: lastMonth } },
            { $group: { _id: null, total: { $sum: "$total_amount" } } }
        ]);

        const todayTotal = todayRevenue[0]?.total || 0;
        const monthTotal = monthRevenue[0]?.total || 0;
        const yearTotal = yearRevenue[0]?.total || 0;
        const lastMonthTotal = lastMonthRevenue[0]?.total || 0;

        const monthGrowth = lastMonthTotal > 0 
            ? (((monthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(2)
            : 0;

        res.json({
            success: true,
            metrics: {
                today: todayTotal,
                month: monthTotal,
                year: yearTotal,
                monthGrowth: parseFloat(monthGrowth)
            }
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
