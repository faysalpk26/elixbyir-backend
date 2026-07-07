const express = require('express');
const router = express.Router();
const { getAllBlogCategories, getBlogCategoryById, createBlogCategory, updateBlogCategory, toggleActiveStatusOfBlogCategory, deleteBlogCategory, reorderBlogCategory, getBlogCategoryStats } = require('../controllers/blogCategoryController');
const { verifyStaffUsersToken, requirePermission } = require('../middleware/rbac-middleware');

router.get('/blog-categories', getAllBlogCategories);

// GET - Fetch single category by ID
router.get("/blog-categories/:id", getBlogCategoryById)

// POST - Create new category
router.post("/blog-categories", verifyStaffUsersToken, requirePermission('blogCategories:create'), createBlogCategory)


// PUT - Update category
router.put("/blog-categories/:id", verifyStaffUsersToken, requirePermission('blogCategories:update'), updateBlogCategory)


// PATCH - Toggle category active status
router.patch("/blog-categories/:id/toggle-active", verifyStaffUsersToken, requirePermission('blogCategories:update'), toggleActiveStatusOfBlogCategory)

// DELETE - Delete category
router.delete("/blog-categories/:id", verifyStaffUsersToken, requirePermission('blogCategories:delete'), deleteBlogCategory)


// POST - Reorder categories
router.post("/blog-categories/reorder", verifyStaffUsersToken, requirePermission('blogCategories:update'), reorderBlogCategory )

// GET - Get category statistics
router.get("/blog-categories/stats/overview",  getBlogCategoryStats)



// Create Payment Intent


module.exports = router;
