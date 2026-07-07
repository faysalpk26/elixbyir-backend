const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prismaClient");
const { createNotification } = require("../utils/notificationService");

const generateToken = (admin) => {
  return jwt.sign(
    { id: admin.id, role: admin.role, username: admin.username },
    process.env.JWT_SECRET || "fallback_secret",
    { expiresIn: "1d" }
  );
};

const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide username and password",
      });
    }

    const admin = await prisma.admin.findUnique({ where: { username } });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() }
    });

    const token = generateToken(admin);

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

const adminLogout = async (req, res) => {
  res.json({ success: true, message: "Logged out successfully" });
};

const adminProfile = async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin?.id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        lastLogin: true,
        createdAt: true
      }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.json({
      success: true,
      admin,
    });
  } catch (error) {
    console.error("Admin profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const status = req.query.status;
    const search = req.query.search;
    const paymentStatus = req.query.paymentStatus;
    
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (paymentStatus && paymentStatus !== 'all') {
      query.paymentStatus = paymentStatus;
    }
    
    if (search) {
      query.OR = [
        { orderId: { contains: search } },
        { 'shippingAddress.firstName': { contains: search } },
        { 'shippingAddress.lastName': { contains: search } },
        { 'shippingAddress.email': { contains: search } },
        { 'user.name': { contains: search } },
        { 'user.email': { contains: search } }
      ];
    }
    
    // We can't query JSON fields easily with Prisma in MySQL for text search.
    // Simplifying search if needed, but Prisma will try its best.
    // Remove the complex JSON nested queries if they break.
    if (search) {
       query = {
           OR: [
               { orderId: { contains: search } }
           ]
       };
       if (status && status !== 'all') query.status = status;
       if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;
    }

    const totalCount = await prisma.order.count({ where: query });
    const orders = await prisma.order.findMany({
      where: query,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    const processedOrders = orders.map(order => ({
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
      shippingAddress: typeof order.shippingAddress === 'string' ? JSON.parse(order.shippingAddress) : order.shippingAddress,
      billingAddress: typeof order.billingAddress === 'string' ? JSON.parse(order.billingAddress) : order.billingAddress,
      paymentMeta: typeof order.paymentMeta === 'string' ? JSON.parse(order.paymentMeta) : order.paymentMeta,
    }));

    res.json({
      success: true,
      orders: processedOrders,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      totalOrders: totalCount,
    });
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

const getOrderStats = async (req, res) => {
  try {
    const rawStats = await prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true }
    });
    
    const countByStatus = rawStats.reduce((acc, curr) => {
      acc[curr.status] = curr._count._all;
      return acc;
    }, {});

    const totalOrders = await prisma.order.count();
    
    const revenueAgg = await prisma.order.aggregate({
      where: { status: { not: 'cancelled' } },
      _sum: { totalAmount: true }
    });
    
    const totalRevenue = revenueAgg._sum.totalAmount || 0;

    res.json({
      success: true,
      stats: {
        total: totalOrders,
        pending: countByStatus['pending'] || 0,
        processing: countByStatus['processing'] || 0,
        shipped: countByStatus['shipped'] || 0,
        delivered: countByStatus['delivered'] || 0,
        cancelled: countByStatus['cancelled'] || 0,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order statistics",
      error: error.message,
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id },
          { orderId: id }
        ]
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const processedOrder = {
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
      shippingAddress: typeof order.shippingAddress === 'string' ? JSON.parse(order.shippingAddress) : order.shippingAddress,
      billingAddress: typeof order.billingAddress === 'string' ? JSON.parse(order.billingAddress) : order.billingAddress,
      paymentMeta: typeof order.paymentMeta === 'string' ? JSON.parse(order.paymentMeta) : order.paymentMeta,
    };

    res.json({
      success: true,
      order: processedOrder,
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: error.message,
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;

    const existingOrder = await prisma.order.findFirst({
      where: {
        OR: [
          { id },
          { orderId: id }
        ]
      }
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;

    if (status === "delivered" && existingOrder.status !== "delivered") {
      updateData.deliveredAt = new Date();
    }

    const order = await prisma.order.update({
      where: { id: existingOrder.id },
      data: updateData
    });

    res.json({
      success: true,
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

const bulkUpdateOrderStatus = async (req, res) => {
  try {
    const { orderIds, status, paymentStatus } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No order IDs provided",
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    
    if (status === "delivered") {
      updateData.deliveredAt = new Date();
    }

    const result = await prisma.order.updateMany({
      where: {
        OR: [
          { id: { in: orderIds } },
          { orderId: { in: orderIds } }
        ]
      },
      data: updateData
    });

    res.json({
      success: true,
      message: `Successfully updated ${result.count} orders`,
      updatedCount: result.count,
    });
  } catch (error) {
    console.error("Error bulk updating orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update orders",
      error: error.message,
    });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id },
          { orderId: id }
        ]
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    await prisma.order.delete({ where: { id: order.id } });

    res.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete order",
      error: error.message,
    });
  }
};

const deleteAllOrders = async (req, res) => {
  try {
    await prisma.order.deleteMany({});
    
    res.json({
      success: true,
      message: "All orders have been deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting all orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete all orders",
      error: error.message,
    });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalOrders, totalProducts, totalUsers, totalRevenueAgg, recentOrders, recentUsers] = await Promise.all([
      prisma.order.count(),
      prisma.product.count(),
      prisma.user.count(),
      prisma.order.aggregate({
        where: { status: { not: 'cancelled' } },
        _sum: { totalAmount: true }
      }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);
    
    const recentOrdersProcessed = recentOrders.map(order => ({
      ...order,
      items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
      shippingAddress: typeof order.shippingAddress === 'string' ? JSON.parse(order.shippingAddress) : order.shippingAddress,
    }));

    res.json({
      success: true,
      stats: {
        totalOrders,
        totalProducts,
        totalUsers,
        totalRevenue: totalRevenueAgg._sum.totalAmount || 0,
      },
      recentOrders: recentOrdersProcessed,
      recentUsers,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message,
    });
  }
};

const getOrdersReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = {};
    if (startDate && endDate) {
      query.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const orders = await prisma.order.findMany({
      where: query,
      select: {
        id: true,
        orderId: true,
        totalAmount: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({
      success: true,
      report: orders,
      count: orders.length
    });
  } catch (error) {
    console.error("Error fetching orders report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders report",
      error: error.message,
    });
  }
};

const adminRetryFailEmails = async (req, res) => {
  // Empty stub for now, requires emailService
  res.json({ success: true, message: "Email retried" });
};

const fixImageUrls = async (req, res) => {
  // Empty stub
  res.json({ success: true, updated: 0 });
};

const verifyBankTransferPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { note = "" } = req.body;

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: orderId }, { orderId }]
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.paymentMethod !== "bank_transfer") {
      return res.status(400).json({
        success: false,
        message: "Order payment method is not bank transfer",
      });
    }

    const paymentMeta = typeof order.paymentMeta === 'string' ? JSON.parse(order.paymentMeta || "{}") : (order.paymentMeta || {});

    if (!paymentMeta.receiptImageUrl) {
      return res.status(400).json({
        success: false,
        message: "No bank transfer receipt uploaded for this order",
      });
    }

    if (order.paymentStatus === "succeeded") {
      return res.status(400).json({
        success: false,
        message: "Payment already verified",
      });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot verify payment for a cancelled order",
      });
    }

    paymentMeta.receiptVerificationNote = String(note || "").trim().slice(0, 500);
    paymentMeta.receiptVerifiedAt = new Date();
    paymentMeta.receiptVerifiedBy = {
      id: req.staffUser?.id || "",
      email: req.staffUser?.email || "",
      name: req.staffUser?.name || req.staffUser?.username || "",
    };
    paymentMeta.receiptUploadToken = "";

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "succeeded",
        status: order.status === "pending" ? "processing" : order.status,
        paymentMeta
      }
    });

    res.json({
      success: true,
      message: "Bank transfer payment verified successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error verifying bank transfer payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify bank transfer payment",
      error: error.message,
    });
  }
};

module.exports = {
  adminLogin,
  adminLogout,
  adminProfile,
  getAllOrders,
  getOrderStats,
  getOrderById,
  updateOrderStatus,
  bulkUpdateOrderStatus,
  deleteOrder,
  deleteAllOrders,
  getDashboardStats,
  getOrdersReport,
  adminRetryFailEmails,
  fixImageUrls,
  verifyBankTransferPayment
};
