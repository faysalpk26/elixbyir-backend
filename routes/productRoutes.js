const express = require("express");
const {
  addProduct,
  updateProduct,
  getProductById,
  getProductBySlug,
  getFeaturedProducts,
  searchProducts,
  getProductsByCategory,
  getProductFilters,
  getCategories,
  getAllProducts,
  removeProduct,
  incrementSalesCountOfProduct,
  getProductRecommendations,
  bulkStatusOperations,
  bulkDeleteProduct,
  updateProductInventory,
  getProductAnalytics,
  bulkUpdateProduct,
  productSeoSitemap,
  updateProductStock,
  productInventoryManagement,
  generateSampleDataForProductsAndSales,
  toggleActiveStatusOfProduct,
  getProductReviews,
  upsertProductReview,
  deleteProductReview,
  importProductsFromExcel,
} = require("../controllers/productController");
const {
  verifyStaffUsersToken,
  requirePermission,
} = require("../middleware/rbac-middleware");
const { verifyToken } = require("../middleware/authMiddleware");
const { bulkUpload } = require("../config/multer");
const router = express.Router();

// Enhanced API for add product with all new fields
router.post(
  "/addproduct",
  verifyStaffUsersToken,
  requirePermission("products:create"),
  addProduct,
);

// Enhanced API for updating products
router.post(
  "/updateproduct",
  verifyStaffUsersToken,
  requirePermission("products:update"),
  updateProduct,
);

// Enhanced API for getting single product with all fields and view tracking
router.get("/product/:id", getProductById);

// Enhanced API for getting products by slug (SEO-friendly URLs)
router.get("/product/slug/:slug", getProductBySlug);

// API for getting featured products
router.get("/featured-products", getFeaturedProducts);

// API for getting products by category with enhanced filtering
router.get("/category/:category", getProductsByCategory);

// Enhanced search API with more filters
router.get("/search", searchProducts);

// API for getting product filters (brands, colors, sizes, price range)
router.get("/product-filters", getProductFilters);

// Enhanced removeproduct API
router.post(
  "/removeproduct",
  verifyStaffUsersToken,
  requirePermission("products:delete"),
  removeProduct,
);

// PATCH - Toggle category active status
router.patch(
  "/product/:id/toggle-active",
  verifyStaffUsersToken,
  requirePermission("products:update"),
  toggleActiveStatusOfProduct,
);

// Enhanced allproducts API (IMPORTANT: Remove available: true filter for admin panel)
router.get("/allproducts", getAllProducts);

router.get("/categories", getCategories);

// =============================================
// NEW ENDPOINTS FOR PRODUCT DETAILS SUPPORT
// =============================================

// Get product analytics
router.get(
  "/product/:id/analytics",
  verifyStaffUsersToken,
  requirePermission("products:read"),
  getProductAnalytics,
);

// Update product inventory
router.put(
  "/product/:id/inventory",
  verifyStaffUsersToken,
  requirePermission("products:update"),
  updateProductInventory,
);

// Increment sales count when a sale is made
router.post(
  "/product/:id/sale",
  verifyStaffUsersToken,
  requirePermission("analytics:read"),
  incrementSalesCountOfProduct,
);

// Get product recommendations
router.get("/product/:id/recommendations", getProductRecommendations);

// Bulk operations for admin efficiency
router.post(
  "/products/bulk-status",
  verifyStaffUsersToken,
  requirePermission("products:update"),
  bulkStatusOperations,
);

// Bulk delete products
router.post(
  "/products/bulk-delete",
  verifyStaffUsersToken,
  requirePermission("products:delete"),
  bulkDeleteProduct,
);

// API for bulk operations
router.post(
  "/products/bulk-update",
  verifyStaffUsersToken,
  requirePermission("products:update"),
  bulkUpdateProduct,
);

// Generate sample sales data for testing
router.post(
  "/generate-sample-data",
  verifyStaffUsersToken,
  requirePermission("analytics:read"),
  generateSampleDataForProductsAndSales,
);

// API for inventory management
router.get(
  "/inventory/low-stock",
  verifyStaffUsersToken,
  requirePermission("products:update"),
  productInventoryManagement,
);

// API for updating stock quantity
router.post(
  "/inventory/update-stock",
  verifyStaffUsersToken,
  requirePermission("products:update"),
  updateProductStock,
);

// API for SEO sitemap
router.get("/sitemap/products", productSeoSitemap);

router.get("/product/:id/reviews", getProductReviews);
router.post("/product/:id/reviews", verifyToken, upsertProductReview);

// Delete product review - Admin only with products:update permission
router.delete(
  "/product/:id/reviews/:reviewId",
  verifyStaffUsersToken,
  requirePermission("products:update"),
  deleteProductReview,
);

router.post(
  "/products/import-excel",
  verifyStaffUsersToken,
  requirePermission("products:create"),
  bulkUpload.single("file"),
  importProductsFromExcel,
);


module.exports = router;
