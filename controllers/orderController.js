const prisma = require("../utils/prismaClient");
const {
  sendOrderStatusEmail,
} = require("../utils/emailService");
const { createNotification } = require("../utils/notificationService");
const { buildTrustedOrderData } = require("../utils/checkoutValidation");
const { resolveCheckoutUser } = require("../utils/checkoutUserResolver");

const normalizeSelectedOptions = (selectedOptions = {}) => {
  if (!selectedOptions || typeof selectedOptions !== "object") return {};
  return Object.entries(selectedOptions)
    .map(([key, value]) => [String(key).trim(), String(value ?? "").trim()])
    .filter(([key, value]) => key.length > 0 && value.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
};

// Create order timeline helper
const createOrderTimeline = (order) => {
  const timeline = [];

  timeline.push({
    title: "Order Placed",
    description: "Your order has been successfully placed",
    date: order.createdAt,
    completed: true,
  });

  if (
    ["confirmed", "processing", "shipped", "delivered"].includes(order.status)
  ) {
    timeline.push({
      title: "Order Confirmed",
      description: "Your order has been confirmed and is being prepared",
      date: order.updatedAt,
      completed: true,
    });
  }

  if (["processing", "shipped", "delivered"].includes(order.status)) {
    timeline.push({
      title: "Processing",
      description: "Your order is being processed and prepared for shipping",
      date: order.status === "processing" ? order.updatedAt : null,
      completed: ["processing", "shipped", "delivered"].includes(order.status),
    });
  }

  if (["shipped", "delivered"].includes(order.status)) {
    timeline.push({
      title: "Shipped",
      description: "Your order has been shipped and is on the way",
      date: order.status === "shipped" ? order.updatedAt : null,
      completed: ["shipped", "delivered"].includes(order.status),
    });
  }

  timeline.push({
    title: "Delivered",
    description: "Your order has been delivered",
    date: order.status === "delivered" ? order.updatedAt : null,
    completed: order.status === "delivered",
  });

  if (order.status === "cancelled") {
    timeline.push({
      title: "Order Cancelled",
      description: "Your order has been cancelled",
      date: order.updatedAt,
      completed: true,
    });
  }

  return timeline;
};

// Create new order
const createOrder = async (req, res) => {
  try {
    const {
      userId,
      items,
      shippingAddress,
      billingAddress,
      paymentIntentId,
      paymentMethod = "stripe",
      promoCode,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart items are required",
      });
    }

    if (paymentMethod !== "stripe") {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment method for this endpoint. Use dedicated PayPal/COD/Bank Transfer endpoints.",
      });
    }

    if (!paymentIntentId || String(paymentIntentId).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Stripe payment intent is required",
      });
    }

    const requiredShippingFields = [
      "name",
      "email",
      "phone",
      "address",
      "city",
      "state",
      "zipCode",
      "country",
    ];
    const hasValidShipping = requiredShippingFields.every(
      (field) => String(shippingAddress?.[field] || "").trim().length > 0,
    );

    if (!hasValidShipping) {
      return res.status(400).json({
        success: false,
        message: "Complete shipping address is required",
      });
    }

    const checkoutUser = resolveCheckoutUser(req, userId);
    const normalizedUserId = checkoutUser.userId;
    const isGuestCheckout = !checkoutUser.isAuthenticated;

    if (isGuestCheckout) {
      const settings = await prisma.settings.findFirst({
        select: { allowGuestCheckout: true }
      });

      if ((settings?.allowGuestCheckout ?? true) === false) {
        return res.status(403).json({
          success: false,
          message: "Guest checkout is disabled. Please login to continue.",
        });
      }
    }

    const trustedOrder = await buildTrustedOrderData({
      items,
      promoCode,
      userId: normalizedUserId,
    });

    // Generate unique order ID
    const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const order = await prisma.order.create({
      data: {
        userId: normalizedUserId,
        orderId,
        stripePaymentIntentId: paymentIntentId,
        items: trustedOrder.items,
        shippingAddress,
        billingAddress: billingAddress || shippingAddress,
        amount: trustedOrder.amount,
        totalAmount: trustedOrder.amount?.total || 0,
        status: "pending",
        paymentStatus: "pending",
        paymentMethod,
      }
    });

    await createNotification({
      type: "order.created",
      title: "New order placed",
      message: `Order ${order.orderId} created`,
      severity: "critical",
      actor: { kind: "user", id: normalizedUserId },
      target: { kind: "order", id: order.id, label: order.orderId },
      audience: { permissions: ["orders:read"] },
    });

    res.json({
      success: true,
      order: order,
      orderId: orderId,
    });
  } catch (error) {
    console.error("❌ Order creation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
};

// Get user orders
const getUserOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = "",
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { userId: req.user.id };

    if (status && status !== "") {
      query.status = status;
    }

    if (search && search !== "") {
      query.OR = [
        { orderId: { contains: search } },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalOrders = await prisma.order.count({ where: query });
    const totalPages = Math.ceil(totalOrders / limitNum);

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? "desc" : "asc";

    const orders = await prisma.order.findMany({
      where: query,
      orderBy: sortOptions,
      skip,
      take: limitNum
    });

    const transformedOrders = orders.map((order) => {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
      const amount = typeof order.amount === 'string' ? JSON.parse(order.amount) : (order.amount || {});
      const shippingAddress = typeof order.shippingAddress === 'string' ? JSON.parse(order.shippingAddress) : (order.shippingAddress || {});
      const billingAddress = typeof order.billingAddress === 'string' ? JSON.parse(order.billingAddress) : (order.billingAddress || {});
      
      return {
        id: order.id,
        orderId: order.orderId,
        orderNumber: order.orderId,
        status: order.status || "pending",
        totalAmount: amount.total || order.totalAmount || 0,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        paymentMethod:
          order.paymentMethod === "stripe"
            ? "Credit Card"
            : order.paymentMethod === "paypal"
              ? "PayPal"
              : order.paymentMethod || "Credit Card",
        paymentStatus: order.paymentStatus || "completed",
        items: items.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          selectedOptions: normalizeSelectedOptions(item.selectedOptions),
          variantHash: item.variantHash || "",
        })),
        shippingAddress,
        billingAddress,
      };
    });

    res.json({
      success: true,
      orders: transformedOrders,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalOrders,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const rawOrderId = String(req.params.orderId || "").trim();

    const order = await prisma.order.findFirst({
      where: {
        userId: req.user.id,
        OR: [
          { id: rawOrderId },
          { orderId: rawOrderId }
        ]
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const items = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
    const amount = typeof order.amount === 'string' ? JSON.parse(order.amount) : (order.amount || {});
    const shippingAddress = typeof order.shippingAddress === 'string' ? JSON.parse(order.shippingAddress) : (order.shippingAddress || {});
    const billingAddress = typeof order.billingAddress === 'string' ? JSON.parse(order.billingAddress) : (order.billingAddress || {});

    const transformedOrder = {
      id: order.id,
      orderId: order.orderId,
      orderNumber: order.orderId,
      status: order.status || "pending",
      totalAmount: amount.total || order.totalAmount || 0,
      subtotal: amount.subtotal || 0,
      shipping: amount.shipping || 0,
      tax: amount.tax || 0,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paymentMethod:
        order.paymentMethod === "stripe"
          ? "Credit Card"
          : order.paymentMethod === "paypal"
            ? "PayPal"
            : order.paymentMethod === "cod"
              ? "Cash on Delivery"
              : order.paymentMethod === "bank_transfer"
                ? "Bank Transfer"
                : order.paymentMethod || "Credit Card",
      paymentStatus: order.paymentStatus || "pending",
      items: items.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        productId: item.productId,
        selectedOptions: normalizeSelectedOptions(item.selectedOptions),
        variantHash: item.variantHash || "",
      })),
      shippingAddress,
      billingAddress,
      timeline: createOrderTimeline(order),
    };

    return res.json({
      success: true,
      order: transformedOrder,
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: error.message,
    });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const rawOrderId = String(req.params.orderId || "").trim();

    const order = await prisma.order.findFirst({
      where: {
        userId: req.user.id,
        OR: [
          { id: rawOrderId },
          { orderId: rawOrderId }
        ]
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const cancellableStatuses = ["pending", "confirmed", "processing"];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}`,
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: "cancelled" }
    });

    await createNotification({
      type: "order.cancelled",
      title: "Order cancelled",
      message: `Order ${updatedOrder.orderId} was cancelled`,
      severity: "critical",
      actor: { kind: "user", id: updatedOrder.userId },
      target: { kind: "order", id: updatedOrder.id, label: updatedOrder.orderId },
      audience: { permissions: ["orders:read"] },
    });

    return res.json({
      success: true,
      message: "Order cancelled successfully",
      order: {
        id: updatedOrder.id,
        orderId: updatedOrder.orderId,
        status: updatedOrder.status,
      },
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};

// Get order statistics
const getOrderStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const statsGroup = await prisma.order.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    });

    const statsAgg = await prisma.order.aggregate({
      where: { userId },
      _sum: { totalAmount: true },
      _count: { _all: true }
    });

    const statusCounts = {};
    statsGroup.forEach(group => {
      statusCounts[group.status] = group._count._all;
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrdersCount = await prisma.order.count({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    const summary = {
      totalOrders: statsAgg._count._all || 0,
      totalSpent: statsAgg._sum.totalAmount || 0,
      statusCounts,
      recentOrdersCount,
    };

    res.json({
      success: true,
      stats: summary,
    });
  } catch (error) {
    console.error("❌ Error fetching order stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order statistics",
      error: error.message,
    });
  }
};

// Update order status (internal use)
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await prisma.order.findUnique({ where: { orderId } });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    
    const updateData = { status };
    if (status === "delivered" && order.status !== "delivered") {
      updateData.deliveredAt = new Date();
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: updateData
    });

    // Send status update email
    try {
      const shippingAddress = typeof updatedOrder.shippingAddress === 'string' ? JSON.parse(updatedOrder.shippingAddress) : (updatedOrder.shippingAddress || {});
      if (
        shippingAddress.email &&
        typeof sendOrderStatusEmail === "function"
      ) {
        await sendOrderStatusEmail(updatedOrder, status);
      }
    } catch (emailError) {
      console.error("❌ Status email failed:", emailError);
    }

    await createNotification({
      type: "order.status.updated",
      title: "Order status updated",
      message: `Order ${updatedOrder.orderId} → ${status}`,
      severity: "info",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "order", id: updatedOrder.id, label: updatedOrder.orderId },
      audience: { permissions: ["orders:read"] },
    });

    res.json({
      success: true,
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};

const deleteOrderBulk = async (req, res) => {
  try {
    const incomingIds = Array.isArray(req.body?.ids) ? req.body.ids : [];

    if (incomingIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one order id is required",
      });
    }

    const validIds = [...new Set(incomingIds.map((id) => String(id).trim()).filter(Boolean))];

    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid order ids provided",
        invalidIds: [],
      });
    }

    const ordersToDelete = await prisma.order.findMany({
      where: { id: { in: validIds } },
      select: { id: true }
    });

    if (ordersToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching orders found",
        invalidIds: [],
        notFoundIds: validIds,
      });
    }

    const deletedIds = ordersToDelete.map((b) => b.id);
    const notFoundIds = validIds.filter((id) => !deletedIds.includes(id));

    await prisma.order.deleteMany({ where: { id: { in: deletedIds } } });

    try {
      await createNotification({
        type: "order.bulk_deleted",
        title: "Order deleted",
        message: `${deletedIds.length} order(s) deleted`,
        severity: "critical",
        actor: {
          kind: "staff",
          id: req.staffUser?.id,
          email: req.staffUser?.email,
        },
        target: {
          kind: "order",
          label: `${deletedIds.length} order`,
        },
        audience: { permissions: ["orders:read"] },
      });
    } catch (notificationErr) {
      console.error(
        "order delete notification failed:",
        notificationErr.message,
      );
    }

    return res.status(200).json({
      success: true,
      message: `Deleted ${deletedIds.length} order(s) successfully`,
      deletedCount: deletedIds.length,
      deletedIds,
      invalidIds: [],
      notFoundIds,
    });
  } catch (error) {
    console.error("Error bulk deleting order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to bulk delete orders",
      error: error.message,
    });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getOrderStats,
  updateOrderStatus,
  deleteOrderBulk,
};
