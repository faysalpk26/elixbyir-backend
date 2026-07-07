const express = require('express');
const router = express.Router();
const { getAllCategories, getCategoryById, createCategory, updateCategory, toggleCategoryActiveStatus, deleteCategory, reorderCategory, getCategoryStats } = require('../controllers/categoryController');
const { verifyStaffUsersToken, requirePermission } = require('../middleware/rbac-middleware');

router.get('/categories', getAllCategories )

// GET - Fetch single category by ID
router.get('/categories/:id', getCategoryById )

// POST - Create new category
router.post('/categories', verifyStaffUsersToken, requirePermission('categories:create'), createCategory )

// PUT - Update category
router.put('/categories/:id', verifyStaffUsersToken, requirePermission('categories:update'), updateCategory )

// PATCH - Toggle category active status
router.patch('/categories/:id/toggle-active', verifyStaffUsersToken, requirePermission('categories:update'), toggleCategoryActiveStatus )

// DELETE - Delete category
router.delete('/categories/:id',verifyStaffUsersToken, requirePermission('categories:delete'), deleteCategory ) 

// POST - Reorder categories
router.post('/categories/reorder', verifyStaffUsersToken, requirePermission('categories:update'), reorderCategory )

// GET - Get category statistics
router.get('/categories/stats/overview', verifyStaffUsersToken, requirePermission('categories:read'),  getCategoryStats )


module.exports = router;