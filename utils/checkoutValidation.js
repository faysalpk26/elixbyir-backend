const Product = require("../models/productModel");
const PromoCode = require("../models/promoCodeModel");

const TAX_RATE = 0.08;
const FREE_SHIPPING_THRESHOLD = 75;
const STANDARD_SHIPPING = 9.99;
const MAX_QTY_PER_ITEM = 99;

const roundCurrency = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

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

const normalizeItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error("Cart items are required");
    err.statusCode = 400;
    throw err;
  }

  return items.map((item, index) => {
    const productId = Number(item?.id ?? item?.productId);
    const quantity = Math.min(
      MAX_QTY_PER_ITEM,
      Math.max(parseInt(item?.quantity, 10) || 0, 1),
    );

    if (!Number.isFinite(productId) || productId <= 0) {
      const err = new Error(`Invalid product id at cart item #${index + 1}`);
      err.statusCode = 400;
      throw err;
    }

    return {
      productId,
      quantity,
      selectedOptions: normalizeSelectedOptions(item?.selectedOptions),
      variantHash: String(item?.variantHash || ""),
    };
  });
};

const calculatePromoDiscount = async ({ promoCode, userId, subtotal }) => {
  const code = String(promoCode || "").trim().toUpperCase();
  if (!code || subtotal <= 0) return { discount: 0, promo: null };

  const promo = await PromoCode.findOne({ code }).lean();
  if (!promo) {
    const err = new Error("Invalid promo code");
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  if (!promo.isActive || now < promo.validFrom || now > promo.validUntil) {
    const err = new Error("Promo code is not valid right now");
    err.statusCode = 400;
    throw err;
  }

  if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
    const err = new Error("Promo code usage limit reached");
    err.statusCode = 400;
    throw err;
  }

  if (subtotal < Number(promo.minPurchaseAmount || 0)) {
    const err = new Error(
      `Minimum purchase of $${Number(promo.minPurchaseAmount || 0).toFixed(2)} is required for this promo code`,
    );
    err.statusCode = 400;
    throw err;
  }

  const normalizedUserId = String(userId || "").trim().toLowerCase();
  if (
    normalizedUserId &&
    normalizedUserId !== "guest" &&
    promo.usagePerUser &&
    promo.usagePerUser > 0
  ) {
    const usageCountForUser = (promo.usedBy || []).filter(
      (entry) => String(entry.userId || "") === String(userId),
    ).length;

    if (usageCountForUser >= promo.usagePerUser) {
      const err = new Error("Promo code usage limit reached for this account");
      err.statusCode = 400;
      throw err;
    }
  }

  let discount = 0;
  if (promo.discountType === "percentage") {
    discount = (subtotal * Number(promo.discountValue || 0)) / 100;
  } else {
    discount = Number(promo.discountValue || 0);
  }

  if (promo.maxDiscountAmount && discount > promo.maxDiscountAmount) {
    discount = Number(promo.maxDiscountAmount);
  }

  discount = Math.min(roundCurrency(discount), subtotal);
  return { discount, promo };
};

const buildTrustedOrderData = async ({
  items,
  promoCode = "",
  userId = "guest",
}) => {
  const normalizedItems = normalizeItems(items);
  const uniqueIds = [...new Set(normalizedItems.map((item) => item.productId))];

  const products = await Product.find({
    id: { $in: uniqueIds },
    available: true,
  })
    .select("id name new_price image images stock_quantity available")
    .lean();

  const productById = new Map(products.map((product) => [Number(product.id), product]));

  if (products.length !== uniqueIds.length) {
    const missing = uniqueIds.filter((id) => !productById.has(Number(id)));
    const err = new Error(
      `Some products are unavailable or missing: ${missing.join(", ")}`,
    );
    err.statusCode = 400;
    throw err;
  }

  let subtotal = 0;

  const trustedItems = normalizedItems.map((item) => {
    const product = productById.get(item.productId);
    const stock = Number(product.stock_quantity || 0);

    if (item.quantity > stock) {
      const err = new Error(
        `${product.name} has only ${stock} item(s) left in stock`,
      );
      err.statusCode = 400;
      throw err;
    }

    const unitPrice = roundCurrency(product.new_price);
    const lineTotal = roundCurrency(unitPrice * item.quantity);
    subtotal = roundCurrency(subtotal + lineTotal);

    return {
      productId: Number(product.id),
      name: product.name || "",
      price: unitPrice,
      quantity: item.quantity,
      image: product.image || product.images?.[0] || "",
      selectedOptions: item.selectedOptions,
      variantHash: item.variantHash,
    };
  });

  const { discount } = await calculatePromoDiscount({
    promoCode,
    userId,
    subtotal,
  });

  const shipping =
    subtotal > FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
  const taxableAmount = Math.max(subtotal - discount, 0);
  const tax = roundCurrency(taxableAmount * TAX_RATE);
  const total = roundCurrency(subtotal + shipping + tax - discount);

  return {
    items: trustedItems,
    amount: {
      subtotal,
      shipping: roundCurrency(shipping),
      tax,
      discount,
      total,
    },
  };
};

module.exports = {
  TAX_RATE,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING,
  roundCurrency,
  normalizeSelectedOptions,
  buildTrustedOrderData,
};
