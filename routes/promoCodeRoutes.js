const express = require("express");
const router = express.Router();
const PromoCode = require("../models/promoCodeModel");
const {
  createPromoCode,
  getAllPromoCodes,
  updatePromoCode,
  deletePromoCode,
  togglePromoCodeStatus,
  validatePromoCode,
  applyPromoCode,
  getPromoCodeStats,
  getActivePromoCodes,
  getPromoCode,
  deletePromoCodeBulk,
} = require("../controllers/promocodeController");
const { verifyStaffUsersToken, requirePermission } = require("../middleware/rbac-middleware");

router.post("/promo-codes/create" , verifyStaffUsersToken, requirePermission('promoCodes:create') , createPromoCode);

// 2. GET ALL PROMO CODES (Admin)
router.get("/promo-codes/all" , verifyStaffUsersToken, requirePermission('promoCodes:read'), getAllPromoCodes);

// 4. UPDATE PROMO CODE
router.put("/promo-codes/update/:id" , verifyStaffUsersToken, requirePermission('promoCodes:update'), updatePromoCode);

// 5. DELETE PROMO CODE
router.delete("/promo-codes/delete/:id" , verifyStaffUsersToken, requirePermission('promoCodes:delete'), deletePromoCode);

// 6. TOGGLE PROMO CODE STATUS
router.patch("/promo-codes/toggle-status/:id", verifyStaffUsersToken, requirePermission('promoCodes:update'), togglePromoCodeStatus);

// 7. VALIDATE & APPLY PROMO CODE (For Customers)
router.post("/promo-codes/validate", validatePromoCode);

// 8. APPLY PROMO CODE TO ORDER (Called after order is placed)
router.post("/promo-codes/apply/:code", applyPromoCode);

// 9. GET PROMO CODE STATISTICS (Admin Dashboard)
router.get("/promo-codes/stats", verifyStaffUsersToken, requirePermission('promoCodes:read'), getPromoCodeStats);

// 10. GET ACTIVE PROMO CODES (Public - for display on website)
router.get("/promo-codes/active", getActivePromoCodes);
// 3. GET SINGLE PROMO CODE
router.get("/promo-codes/:id", getPromoCode);

// 11. DELETE bulk PROMO CODE
router.post("/promo-codes/bulk-delete" , verifyStaffUsersToken, requirePermission('promoCodes:delete'), deletePromoCodeBulk);

module.exports = router;
