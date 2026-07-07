const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  stripePaymentIntentId: {
    type: String,
    required: false,
    default: "",
  },
  items: [
    {
      productId: Number,
      name: String,
      price: Number,
      quantity: Number,
      image: String,
      selectedOptions: {
        type: Object,
        default: {},
      },
      variantHash: {
        type: String,
        default: "",
      },
    },
  ],
  shippingAddress: {
    name: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  billingAddress: {
    name: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  amount: {
    subtotal: Number,
    shipping: Number,
    tax: Number,
    discount: Number,
    total: Number,
  },
  status: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ],
    default: "pending",
  },

  paymentStatus: {
    type: String,
    enum: ["pending", "succeeded", "failed", "cancelled"],
    default: "pending",
  },
  paymentMethod: {
    type: String,
    enum: ["stripe", "paypal", "cod", "bank_transfer"],
    default: "stripe",
  },
  paymentMeta: {
    bankTransferInstructions: { type: String, default: "" },
    bankTransferReference: { type: String, default: "" },

    receiptUploadToken: { type: String, default: "" },
    receiptImageUrl: { type: String, default: "" },
    receiptImagePublicId: { type: String, default: "" },
    receiptUploadedAt: { type: Date, default: null },

    receiptVerificationNote: { type: String, default: "" },
    receiptVerifiedAt: { type: Date, default: null },
    receiptVerifiedBy: {
      id: { type: String, default: "" },
      email: { type: String, default: "" },
      name: { type: String, default: "" },
    },
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Order", orderSchema);
