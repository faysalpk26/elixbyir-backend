const Stripe = require("stripe");
const { decryptSecret } = require("../utils/cryptoSecrets");
const {
  sendOrderConfirmationEmail,
  sendTestEmail,
} = require("../utils/emailService");
const { createNotification } = require("../utils/notificationService");
const prisma = require("../utils/prismaClient");

const fs = require("fs");
const crypto = require("crypto");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../utils/cloudinaryUpload");
const { buildTrustedOrderData, roundCurrency } = require("../utils/checkoutValidation");
const { resolveCheckoutUser } = require("../utils/checkoutUserResolver");

const PAYPAL_BASE_URL =
  process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

const ALLOWED_RECEIPT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const REQUIRED_ADDRESS_FIELDS = [
  "name",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "zipCode",
  "country",
];

const hasCompleteAddress = (address = {}) =>
  REQUIRED_ADDRESS_FIELDS.every(
    (field) => String(address?.[field] || "").trim().length > 0,
  );

const cleanupTempFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      // ignore
    }
  }
};

const getPaymentSettings = async () => {
  const settings = await prisma.settings.findFirst({
    select: { paymentSettings: true, allowGuestCheckout: true }
  });
  
  if (settings && typeof settings.paymentSettings === 'string') {
    settings.paymentSettings = JSON.parse(settings.paymentSettings);
  }
  return settings || {};
};

const isGuestCheckoutRequest = (userId) => {
  if (!userId) return true;
  return String(userId).toLowerCase() === "guest";
};

const enforceGuestCheckoutPolicy = (settings, userId) => {
  const allowGuestCheckout = settings?.allowGuestCheckout ?? true;
  if (isGuestCheckoutRequest(userId) && allowGuestCheckout === false) {
    const err = new Error("Guest checkout is disabled. Please login to continue.");
    err.statusCode = 403;
    throw err;
  }
};

const isMethodEnabled = (settings, method) => {
  const enabled = settings?.paymentSettings?.methods?.[method]?.enabled;
  return enabled !== false; // default true for stripe/paypal compatibility
};

const getStripeClient = async () => {
  const { secretKey } = await getStripeRuntimeConfig();
  return new Stripe(secretKey);
};

const getStripeRuntimeConfig = async () => {
  const settings = await getPaymentSettings();

  if (!isMethodEnabled(settings, "stripe")) {
    const err = new Error("Stripe is disabled");
    err.statusCode = 403;
    throw err;
  }

  const dbPublishable =
    settings?.paymentSettings?.credentials?.stripe?.publishableKey?.trim() ||
    "";
  const dbSecret =
    decryptSecret(
      settings?.paymentSettings?.credentials?.stripe?.secretKey,
    )?.trim() || "";

  const envPublishable = (process.env.STRIPE_PUBLISHABLE_KEY || "").trim();
  const envSecret = (process.env.STRIPE_SECRET_KEY || "").trim();

  const hasAnyDbStripe = !!(dbPublishable || dbSecret);

  const publishableKey = hasAnyDbStripe ? dbPublishable : envPublishable;
  const secretKey = hasAnyDbStripe ? dbSecret : envSecret;

  if (!publishableKey || !secretKey) {
    const err = new Error(
      "Stripe is misconfigured: publishable + secret key must come from same source (DB or ENV)",
    );
    err.statusCode = 500;
    throw err;
  }

  return { publishableKey, secretKey };
};

const getPayPalRuntimeConfig = async () => {
  const settings = await getPaymentSettings();

  if (!isMethodEnabled(settings, "paypal")) {
    const err = new Error("PayPal is disabled");
    err.statusCode = 403;
    throw err;
  }

  const clientId =
    settings?.paymentSettings?.credentials?.paypal?.clientId ||
    process.env.PAYPAL_CLIENT_ID;

  const clientSecret =
    decryptSecret(
      settings?.paymentSettings?.credentials?.paypal?.clientSecret,
    ) || process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const err = new Error("PayPal credentials are not configured");
    err.statusCode = 500;
    throw err;
  }

  const baseUrl =
    process.env.PAYPAL_BASE_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com");

  return { clientId, clientSecret, baseUrl };
};

const getPayPalToken = async ({ clientId, clientSecret, baseUrl }) => {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`PayPal token request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
};

// Create Stripe payment intent
const createPaymentIntent = async (req, res) => {
  try {
    const { currency, orderId, userId, items, promoCode } = req.body;

    if (!orderId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "orderId and items are required",
      });
    }

    const serverCurrency = String(process.env.CHECKOUT_CURRENCY || "usd")
      .trim()
      .toLowerCase();
    if (
      currency &&
      String(currency).trim().toLowerCase() !== serverCurrency
    ) {
      return res.status(400).json({
        success: false,
        message: `Unsupported currency. Only ${serverCurrency.toUpperCase()} is allowed.`,
      });
    }

    const checkoutUser = resolveCheckoutUser(req, userId);

    const settings = await getPaymentSettings();
    enforceGuestCheckoutPolicy(settings, checkoutUser.userId);

    const trustedOrder = await buildTrustedOrderData({
      items,
      promoCode,
      userId: checkoutUser.userId,
    });

    const amountInCents = Math.round(trustedOrder.amount.total * 100);

    const stripeClient = await getStripeClient();

    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: amountInCents,
      currency: serverCurrency,
      metadata: {
        orderId,
        userId: checkoutUser.userId,
        subtotal: trustedOrder.amount.subtotal.toFixed(2),
        discount: trustedOrder.amount.discount.toFixed(2),
        total: trustedOrder.amount.total.toFixed(2),
      },
      automatic_payment_methods: { enabled: true },
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      trustedAmount: trustedOrder.amount,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message:
        status === 403 ? error.message : "Failed to create payment intent",
      error: error.message,
    });
  }
};

// Confirm Stripe payment
const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, orderId } = req.body;

    const stripeClient = await getStripeClient();
    const paymentIntent =
      await stripeClient.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      const order = await prisma.order.findUnique({ where: { orderId } });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      if (
        order.stripePaymentIntentId &&
        order.stripePaymentIntentId !== paymentIntentId
      ) {
        return res.status(400).json({
          success: false,
          message: "Payment intent does not match this order",
        });
      }

      const expectedCents = Math.round(Number(order.totalAmount || 0) * 100);
      if (paymentIntent.amount_received !== expectedCents) {
        return res.status(400).json({
          success: false,
          message: "Paid amount does not match order total",
        });
      }

      const updatedOrder = await prisma.order.update({
        where: { orderId },
        data: {
          paymentStatus: "succeeded",
          status: "processing",
          stripePaymentIntentId: paymentIntentId,
        }
      });

      if (updatedOrder) {
        // Clear cart
        if (updatedOrder.userId && updatedOrder.userId !== "guest") {
          await prisma.cart.update({
            where: { userId: updatedOrder.userId },
            data: { items: [] }
          });
        }

        const items = typeof updatedOrder.items === 'string' ? JSON.parse(updatedOrder.items) : (updatedOrder.items || []);

        // Update product stock and sales
        for (const item of items) {
          const parsedId = parseInt(item.productId);
          if (parsedId) {
             const product = await prisma.product.findUnique({ where: { id: parsedId } });
             if (product) {
                 await prisma.product.update({
                   where: { id: parsedId },
                   data: {
                     stock_quantity: { decrement: item.quantity },
                     sales_count: { increment: item.quantity }
                   }
                 });
                 
                 await prisma.sale.create({
                   data: {
                     product_id: String(item.productId),
                     product_name: item.name,
                     category: product.category,
                     price: item.price,
                     quantity: item.quantity,
                     total_amount: item.price * item.quantity,
                     date: new Date(),
                     month: new Date().getMonth() + 1,
                     year: new Date().getFullYear(),
                   }
                 });
             }
          }
        }

        // Send email asynchronously
        setImmediate(async () => {
          try {
            if (typeof sendOrderConfirmationEmail === "function") {
              // Parse strings if necessary for email service
              const orderForEmail = {
                 ...updatedOrder,
                 shippingAddress: typeof updatedOrder.shippingAddress === 'string' ? JSON.parse(updatedOrder.shippingAddress) : updatedOrder.shippingAddress,
                 items: typeof updatedOrder.items === 'string' ? JSON.parse(updatedOrder.items) : updatedOrder.items,
                 amount: typeof updatedOrder.amount === 'string' ? JSON.parse(updatedOrder.amount) : updatedOrder.amount,
                 paymentMeta: typeof updatedOrder.paymentMeta === 'string' ? JSON.parse(updatedOrder.paymentMeta) : updatedOrder.paymentMeta,
              };
              await Promise.race([
                sendOrderConfirmationEmail(orderForEmail),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error("Email timeout")), 20000),
                ),
              ]);
            }
          } catch (emailError) {
            console.error(
              "Email sending failed (non-blocking):",
              emailError.message,
            );
          }
        });
      }

      res.json({
        success: true,
        message: "Payment confirmed successfully",
        order: updatedOrder,
      });
    } else {
      await createNotification({
        type: "order.payment_failed",
        title: "Payment failed",
        message: `Payment failed for order ${orderId}`,
        severity: "critical",
        actor: { kind: "anonymous" },
        target: { kind: "order", id: orderId, label: orderId },
        audience: { permissions: ["orders:read"] },
      });

      res.status(400).json({
        success: false,
        message: "Payment not completed",
        status: paymentIntent.status,
      });
    }
  } catch (error) {
    console.error("Payment confirmation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm payment",
      error: error.message,
    });
  }
};

// Create PayPal order
const createPayPalOrder = async (req, res) => {
  try {
    const { orderId, userId, items, promoCode } = req.body;

    if (!orderId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: orderId, items",
      });
    }

    const checkoutUser = resolveCheckoutUser(req, userId);

    const settings = await getPaymentSettings();
    enforceGuestCheckoutPolicy(settings, checkoutUser.userId);

    const trustedOrder = await buildTrustedOrderData({
      items,
      promoCode,
      userId: checkoutUser.userId,
    });

    const paypalCfg = await getPayPalRuntimeConfig();
    const accessToken = await getPayPalToken(paypalCfg);

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: orderId,
          amount: {
            currency_code: "USD",
            value: trustedOrder.amount.total.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: "USD",
                value: trustedOrder.amount.subtotal.toFixed(2),
              },
              shipping: {
                currency_code: "USD",
                value: trustedOrder.amount.shipping.toFixed(2),
              },
              tax_total: {
                currency_code: "USD",
                value: trustedOrder.amount.tax.toFixed(2),
              },
              discount: {
                currency_code: "USD",
                value: trustedOrder.amount.discount.toFixed(2),
              },
            },
          },
          items: trustedOrder.items.map((item) => ({
            name: item.name.substring(0, 127),
            unit_amount: { currency_code: "USD", value: item.price.toFixed(2) },
            quantity: item.quantity.toString(),
            category: "PHYSICAL_GOODS",
          })),
          description: `Order #${orderId} from Pink Dreams Store`,
        },
      ],
      application_context: {
        brand_name: "Pink Dreams Fashion Store",
        landing_page: "BILLING",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
      },
    };

    const response = await fetch(`${paypalCfg.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const paypalOrder = await response.json();

    if (response.ok && paypalOrder.id) {
      res.json({
        success: true,
        orderID: paypalOrder.id,
        message: "PayPal order created successfully",
        trustedAmount: trustedOrder.amount,
      });
    } else {
      console.error("PayPal order creation failed:", paypalOrder);
      throw new Error(paypalOrder.message || "PayPal order creation failed");
    }
  } catch (error) {
    console.error("PayPal create order error:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message: status === 403 ? error.message : "Failed to create PayPal order",
      error: error.message,
    });
  }
};

// Capture PayPal payment
const capturePayPalOrder = async (req, res) => {
  try {
    const {
      orderID,
      orderId,
      userId,
      items,
      shippingAddress,
      promoCode,
      billingAddress,
    } =
      req.body;

    if (!orderID) {
      return res.status(400).json({
        success: false,
        message: "PayPal Order ID is required",
      });
    }

    if (!hasCompleteAddress(shippingAddress)) {
      return res.status(400).json({
        success: false,
        message: "Complete shipping address is required",
      });
    }

    const checkoutUser = resolveCheckoutUser(req, userId);

    const settings = await getPaymentSettings();
    enforceGuestCheckoutPolicy(settings, checkoutUser.userId);

    const trustedOrder = await buildTrustedOrderData({
      items,
      promoCode,
      userId: checkoutUser.userId,
    });

    const paypalCfg = await getPayPalRuntimeConfig();
    const accessToken = await getPayPalToken(paypalCfg);

    const response = await fetch(
      `${paypalCfg.baseUrl}/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    const captureResult = await response.json();

    if (response.ok && captureResult.status === "COMPLETED") {
      const capturedValue =
        Number(
          captureResult?.purchase_units?.[0]?.payments?.captures?.[0]?.amount
            ?.value || 0,
        ) || 0;
      const expectedValue = Number(trustedOrder.amount.total || 0);
      if (roundCurrency(capturedValue) !== roundCurrency(expectedValue)) {
        return res.status(400).json({
          success: false,
          message: "Captured amount does not match server-calculated order total",
        });
      }

      const finalOrderId =
        orderId ||
        `PAYPAL_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      const resolvedBillingAddress = hasCompleteAddress(billingAddress)
        ? billingAddress
        : shippingAddress;

      const newOrder = await prisma.order.create({
        data: {
          userId: checkoutUser.userId,
          orderId: finalOrderId,
          stripePaymentIntentId: `paypal_${orderID}`,
          items: trustedOrder.items,
          shippingAddress,
          billingAddress: resolvedBillingAddress,
          amount: trustedOrder.amount,
          totalAmount: trustedOrder.amount?.total || 0,
          paymentStatus: "succeeded",
          status: "processing",
          paymentMethod: "paypal",
        }
      });

      // Clear user's cart
      if (checkoutUser.userId && checkoutUser.userId !== "guest") {
        await prisma.cart.update({
          where: { userId: checkoutUser.userId },
          data: { items: [] }
        });
      }

      // Update product inventory and sales
      for (const item of trustedOrder.items) {
          const parsedId = parseInt(item.productId);
          if (parsedId) {
             const product = await prisma.product.findUnique({ where: { id: parsedId } });
             if (product) {
                 await prisma.product.update({
                   where: { id: parsedId },
                   data: {
                     stock_quantity: { decrement: item.quantity },
                     sales_count: { increment: item.quantity }
                   }
                 });
                 
                 await prisma.sale.create({
                   data: {
                     product_id: String(item.productId),
                     product_name: item.name,
                     category: product.category,
                     price: item.price,
                     quantity: item.quantity,
                     total_amount: item.price * item.quantity,
                     date: new Date(),
                     month: new Date().getMonth() + 1,
                     year: new Date().getFullYear(),
                   }
                 });
             }
          }
      }

      // Send order confirmation email
      try {
        const orderForEmail = {
           ...newOrder,
           shippingAddress: typeof newOrder.shippingAddress === 'string' ? JSON.parse(newOrder.shippingAddress) : newOrder.shippingAddress,
           items: typeof newOrder.items === 'string' ? JSON.parse(newOrder.items) : newOrder.items,
           amount: typeof newOrder.amount === 'string' ? JSON.parse(newOrder.amount) : newOrder.amount,
           paymentMeta: typeof newOrder.paymentMeta === 'string' ? JSON.parse(newOrder.paymentMeta) : newOrder.paymentMeta,
        };
        await sendOrderConfirmationEmail(orderForEmail);
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
      }

      res.json({
        success: true,
        message: "PayPal payment completed successfully",
        order: newOrder,
        paypalDetails: {
          captureId: captureResult.id,
          status: captureResult.status,
          orderID: orderID,
        },
      });
    } else {
      console.error("PayPal capture failed:", captureResult);
      res.status(400).json({
        success: false,
        message: "PayPal payment capture failed",
        details: captureResult,
      });
    }
  } catch (error) {
    console.error("PayPal capture error:", error);
    const status = error.statusCode || 500;
    res.status(status).json({
      success: false,
      message:
        status === 403 ? error.message : "Failed to capture PayPal payment",
      error: error.message,
    });
  }
};

//Create offline Order
const createOfflineOrder = async (req, res) => {
  try {
    const {
      orderId,
      userId,
      items,
      shippingAddress,
      billingAddress,
      promoCode,
      paymentMethod, // "cod" | "bank_transfer"
    } = req.body;

    if (!["cod", "bank_transfer"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid offline payment method",
      });
    }

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      !hasCompleteAddress(shippingAddress)
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields for offline order",
      });
    }

    const checkoutUser = resolveCheckoutUser(req, userId);

    const settings = await getPaymentSettings();
    enforceGuestCheckoutPolicy(settings, checkoutUser.userId);
    const methodKey =
      paymentMethod === "bank_transfer" ? "bankTransfer" : "cod";

    if (!isMethodEnabled(settings, methodKey)) {
      return res.status(403).json({
        success: false,
        message: `${paymentMethod} is disabled`,
      });
    }

    const finalOrderId =
      orderId || `ORD_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    const trustedOrder = await buildTrustedOrderData({
      items,
      promoCode,
      userId: checkoutUser.userId,
    });

    const bankInstructions =
      paymentMethod === "bank_transfer"
        ? settings?.paymentSettings?.methods?.bankTransfer?.instructions || ""
        : "";

    // Idempotency: if this orderId already exists, return it (helps retry flows)
    const existingOrder = await prisma.order.findUnique({ where: { orderId: finalOrderId } });
    if (existingOrder) {
      if (
        existingOrder.userId !== checkoutUser.userId ||
        existingOrder.paymentMethod !== paymentMethod
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Order ID already exists with different details. Refresh checkout and try again.",
        });
      }

      let existingPaymentMeta = typeof existingOrder.paymentMeta === 'string' ? JSON.parse(existingOrder.paymentMeta) : (existingOrder.paymentMeta || {});

      if (
        paymentMethod === "bank_transfer" &&
        !existingPaymentMeta.receiptUploadToken
      ) {
        
        existingPaymentMeta.receiptUploadToken = crypto.randomBytes(24).toString("hex");
        existingPaymentMeta.bankTransferReference = existingPaymentMeta.bankTransferReference || finalOrderId;
        existingPaymentMeta.bankTransferInstructions = existingPaymentMeta.bankTransferInstructions || bankInstructions;

        if (!existingPaymentMeta.receiptVerifiedBy) {
          existingPaymentMeta.receiptVerifiedBy = {
            id: "",
            email: "",
            name: "",
          };
        }

        await prisma.order.update({
          where: { id: existingOrder.id },
          data: { paymentMeta: existingPaymentMeta }
        });
        
        existingOrder.paymentMeta = existingPaymentMeta;
      }

      const existingPaymentPayload = {
        method: paymentMethod,
        status: existingOrder.paymentStatus || "pending",
        reference:
          existingPaymentMeta.bankTransferReference ||
          existingOrder.orderId,
        instructions:
          existingPaymentMeta.bankTransferInstructions ||
          bankInstructions,
      };

      if (paymentMethod === "bank_transfer") {
        existingPaymentPayload.receiptUploadToken =
          existingPaymentMeta.receiptUploadToken || "";
      }

      return res.json({
        success: true,
        message: "Offline order already exists",
        order: existingOrder,
        payment: existingPaymentPayload,
      });
    }

    const receiptUploadToken =
      paymentMethod === "bank_transfer"
        ? crypto.randomBytes(24).toString("hex")
        : "";

    const order = await prisma.order.create({
      data: {
        userId: checkoutUser.userId,
        orderId: finalOrderId,
        stripePaymentIntentId: `offline_${paymentMethod}_${Date.now()}`,
        items: trustedOrder.items,
        shippingAddress,
        billingAddress: hasCompleteAddress(billingAddress)
          ? billingAddress
          : shippingAddress,
        amount: trustedOrder.amount,
        totalAmount: trustedOrder.amount?.total || 0,
        status: "pending",
        paymentStatus: "pending",
        paymentMethod,
        paymentMeta: {
          bankTransferInstructions: bankInstructions,
          bankTransferReference: finalOrderId,
          receiptUploadToken,
        },
      }
    });

    await createNotification({
      type: "order.created",
      title: "New order placed",
      message: `Order ${order.orderId} created via ${paymentMethod === "cod" ? "COD" : "bank transfer"}`,
      severity: "critical",
      actor: { kind: "user", id: checkoutUser.userId },
      target: { kind: "order", id: order.id, label: order.orderId },
      audience: { permissions: ["orders:read"] },
    });

    await createNotification({
      type: "order.payment_pending",
      title: "Payment pending",
      message: `Order ${order.orderId} awaiting ${paymentMethod === "cod" ? "COD collection" : "bank transfer confirmation"}`,
      severity: "high",
      actor: { kind: "user", id: checkoutUser.userId },
      target: { kind: "order", id: order.id, label: order.orderId },
      audience: { permissions: ["orders:read"] },
    });

    const paymentPayload = {
      method: paymentMethod,
      status: "pending",
      reference: finalOrderId,
      instructions: bankInstructions,
    };

    if (paymentMethod === "bank_transfer") {
      paymentPayload.receiptUploadToken = receiptUploadToken;
    }

    return res.json({
      success: true,
      message: "Offline order placed successfully",
      order,
      payment: paymentPayload,
    });
  } catch (error) {
    console.error("Offline order creation error:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: status === 403 ? error.message : "Failed to create offline order",
      error: error.message,
    });
  }
};

const uploadBankTransferReceipt = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { receiptUploadToken } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Receipt image is required",
      });
    }

    if (!ALLOWED_RECEIPT_TYPES.has((req.file.mimetype || "").toLowerCase())) {
      cleanupTempFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Use JPG, PNG, or WEBP.",
      });
    }

    if (req.file.size > MAX_RECEIPT_SIZE_BYTES) {
      cleanupTempFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Receipt image is too large. Max size is 5MB.",
      });
    }

    if (!receiptUploadToken) {
      cleanupTempFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Missing receipt upload token",
      });
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: orderId }, { orderId }],
      }
    });

    if (!order) {
      cleanupTempFile(req.file.path);
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.paymentMethod !== "bank_transfer") {
      cleanupTempFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: "This order is not a bank transfer order",
      });
    }

    if (order.paymentStatus !== "pending") {
      cleanupTempFile(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Payment is not in pending state",
      });
    }

    const paymentMeta = typeof order.paymentMeta === 'string' ? JSON.parse(order.paymentMeta) : (order.paymentMeta || {});

    if (
      !paymentMeta.receiptUploadToken ||
      paymentMeta.receiptUploadToken !== receiptUploadToken
    ) {
      cleanupTempFile(req.file.path);
      return res.status(403).json({
        success: false,
        message: "Invalid upload token for this order",
      });
    }

    const uploadResult = await uploadToCloudinary(req.file);

    if (paymentMeta.receiptImagePublicId) {
      try {
        await deleteFromCloudinary(paymentMeta.receiptImagePublicId);
      } catch (err) {
        // ignore
      }
    }

    paymentMeta.receiptImageUrl = uploadResult.url;
    paymentMeta.receiptImagePublicId = uploadResult.public_id;
    paymentMeta.receiptUploadedAt = new Date();

    if (!paymentMeta.receiptVerifiedBy) {
      paymentMeta.receiptVerifiedBy = {
        id: "",
        email: "",
        name: "",
      };
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { paymentMeta }
    });

    await createNotification({
      type: "order.bank_receipt_uploaded",
      title: "Bank transfer receipt uploaded",
      message: `Receipt uploaded for order ${order.orderId}`,
      severity: "high",
      actor: { kind: "user", id: order.userId },
      target: { kind: "order", id: order.id, label: order.orderId },
      audience: { permissions: ["orders:read"] },
    });
    
    return res.json({
      success: true,
      message: "Receipt uploaded successfully",
      order: updatedOrder,
      receipt: {
        url: uploadResult.url,
        uploadedAt: paymentMeta.receiptUploadedAt,
      },
    });
  } catch (error) {
    console.error("Upload bank receipt error:", error);
    if (req.file?.path) cleanupTempFile(req.file.path);
    return res.status(500).json({
      success: false,
      message: "Failed to upload receipt",
      error: error.message,
    });
  }
};

// Test PayPal connection
const testPayPal = async (req, res) => {
  try {
    const paypalCfg = await getPayPalRuntimeConfig();
    const token = await getPayPalToken(paypalCfg);
    res.json({
      success: true,
      message: "PayPal connection successful",
      hasToken: !!token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "PayPal connection failed",
      error: error.message,
    });
  }
};

// Test email service
const testEmail = async (req, res) => {
  try {
    const {
      to = "test@example.com",
      subject = "Test Email from Pink Dreams Railway",
    } = req.body;

    const result = await sendTestEmail(to, subject);

    res.json({
      success: true,
      message: "Email sent successfully from Railway using Resend!",
      messageId: result.messageId,
      service: "Resend",
      from: process.env.EMAIL_FROM || "noreply@resend.dev",
      to: to,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Email test failed:", error);
    res.status(500).json({
      success: false,
      message: "Email test failed",
      error: error.message,
      service: process.env.RESEND_API_KEY
        ? "Resend (configured)"
        : "Gmail (fallback - will fail)",
    });
  }
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  createPayPalOrder,
  capturePayPalOrder,
  testPayPal,
  testEmail,
  createOfflineOrder,
  uploadBankTransferReceipt,
};
