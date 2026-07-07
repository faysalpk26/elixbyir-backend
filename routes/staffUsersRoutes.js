// routes/admin.js
const express = require('express');
const roleCtrl = require('../controllers/roleController');
const userCtrl = require('../controllers/staffUserController');
const { verifyStaffUsersToken, requirePermission } = require('../middleware/rbac-middleware');

const router = express.Router();

// Role routes (role management requires roles:manage OR super_admin)
// router.post('/roles', verifyStaffUsersToken, requirePermission('roles:manage'), roleCtrl.createRole);
// router.get('/roles', verifyStaffUsersToken, requirePermission('roles:manage'), roleCtrl.listRoles);
// router.get('/roles/:id', verifyStaffUsersToken, requirePermission('roles:manage'), roleCtrl.getRole);
// router.put('/roles/:id', verifyStaffUsersToken, requirePermission('roles:manage'), roleCtrl.updateRole);
// router.delete('/roles/:id', verifyStaffUsersToken, requirePermission('roles:manage'), roleCtrl.deleteRole);

// User management
router.post('/staffUsers', verifyStaffUsersToken, requirePermission('staffUsers:create'), userCtrl.adminCreateStaffUser);
router.get('/staffUsers', verifyStaffUsersToken, requirePermission('staffUsers:read'), userCtrl.listStaffUsers);
router.put('/staffUsers/:id', verifyStaffUsersToken, requirePermission('staffUsers:update'), userCtrl.adminUpdateStaffUser);
router.put('/staffUsers/:id/roles', verifyStaffUsersToken, requirePermission('staffUsers:update'), userCtrl.assignRolesToStaffUser);
router.delete('/staffUsers/:id', verifyStaffUsersToken, requirePermission('staffUsers:delete'), userCtrl.deleteStaffUser);

module.exports = router;
