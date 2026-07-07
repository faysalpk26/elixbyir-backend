const { default: mongoose } = require("mongoose");

// Enhanced Schema for creating products with all e-commerce features
const productSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
    },
    // Basic Information
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      default: "",
    },
    sku: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    short_description: {
      type: String,
      default: "",
    },

    // Images
    image: {
      type: String,
      required: true,
    },
    images: {
      type: [String],
      default: [],
    },

    // Pricing
    new_price: {
      type: Number,
      required: true,
    },
    old_price: {
      type: Number,
      required: true,
    },
    discount_type: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    discount_value: {
      type: Number,
      default: 0,
    },
    sale_start_date: {
      type: Date,
    },
    sale_end_date: {
      type: Date,
    },

    // Product Details
    features: {
      type: [String],
      default: [],
    },
    specifications: [
      {
        key: String,
        value: String,
      },
    ],
    materials: {
      type: String,
      default: "",
    },
    care_instructions: {
      type: String,
      default: "",
    },
    size_chart: {
      type: String,
      default: "",
    },
    colors: {
      type: [String],
      default: [],
    },
    sizes: {
      type: [String],
      default: [],
    },
    weight: {
      type: Number,
      default: 0,
    },
    dimensions: {
      length: {
        type: Number,
        default: 0,
      },
      width: {
        type: Number,
        default: 0,
      },
      height: {
        type: Number,
        default: 0,
      },
    },

    // Inventory
    stock_quantity: {
      type: Number,
      default: 0,
    },
    low_stock_threshold: {
      type: Number,
      default: 10,
    },

    // SEO & Meta Data
    meta_title: {
      type: String,
      default: "",
    },
    meta_description: {
      type: String,
      default: "",
    },
    meta_keywords: {
      type: String,
      default: "",
    },
    slug: {
      type: String,
      default: "",
    },

    // Additional Fields
    tags: {
      type: [String],
      default: [],
    },
    related_products: {
      type: [Number],
      default: [],
    },
    shipping_class: {
      type: String,
      enum: ["standard", "express", "overnight", "free"],
      default: "standard",
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },

    // System Fields
    date: {
      type: Date,
      default: Date.now,
    },
    available: {
      type: Boolean,
      default: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    allowReviews: {
      type: Boolean,
      default: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    sales_count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // This adds createdAt and updatedAt automatically
  },
);

// Add virtual for conversion rate calculation
productSchema.virtual("conversion_rate").get(function () {
  return this.views > 0
    ? ((this.sales_count / this.views) * 100).toFixed(2)
    : 0;
});

// Auto-generate SKU and slug if not provided
productSchema.pre("save", function (next) {
  if (!this.sku || this.sku === "") {
    this.sku = `${this.category.substring(0, 3).toUpperCase()}-${this.id}`;
  }

  if (!this.slug || this.slug === "") {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  next();
});

// Ensure virtuals are included in JSON output
productSchema.set("toJSON", { virtuals: true });

// Shop/query performance indexes
productSchema.index({
  available: 1,
  status: 1,
  category: 1,
  brand: 1,
  featured: 1,
  new_price: 1,
  date: -1,
});
productSchema.index({ available: 1, status: 1, new_price: 1 });
productSchema.index({ available: 1, status: 1, date: -1 });
productSchema.index({ available: 1, status: 1, stock_quantity: 1 });
productSchema.index({ category: 1, available: 1, status: 1 });
productSchema.index({ brand: 1, available: 1, status: 1 });
productSchema.index(
  {
    name: "text",
    description: "text",
    category: "text",
    brand: "text",
    tags: "text",
  },
  {
    name: "product_text_search",
    weights: {
      name: 10,
      category: 5,
      brand: 4,
      description: 2,
      tags: 1,
    },
  },
);

module.exports = mongoose.model("Product", productSchema);
