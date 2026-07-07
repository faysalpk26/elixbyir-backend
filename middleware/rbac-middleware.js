// RBAC Middleware for Pink Dreams Store
const jwt = require("jsonwebtoken");
const StaffUser = require("../models/staffUsersModel");
const roleModel = require("../models/roleModel");
const { getTokenFromRequest } = require("../utils/tokenExtractor");
const { STAFF_AUTH_COOKIE_NAME } = require("../utils/staffAuthCookie");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

// Middleware to verify admin/staff token

async function verifyStaffUsersToken(req, res, next) {
  try {
    const token = getTokenFromRequest(req, STAFF_AUTH_COOKIE_NAME);

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const staffUser = await StaffUser.findById(payload.id)
      .populate("role")
      .exec();
    if (!staffUser) {
      return res.status(401).json({ error: "staffUser not found" });
    }

    // token version check ensures role changes force re-login
    if (payload.tokenVersion !== staffUser.tokenVersion) {
      return res
        .status(401)
        .json({ error: "Token expired - re-login required" });
    }

    req.staffUser = staffUser;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
// Middleware to check if user has required permission
// const checkPermission = (requiredPermission) => {
//   return async (req, res, next) => {
//     try {
//       const userId = req.user.userId;
//       const userRole = req.user.role;

//       // Super admin has all permissions
//       if (userRole === 'super_admin') {
//         return next();
//       }

//       // Get user's permissions from database
//       const db = req.app.locals.db;

//       // Get user with their role and permissions
//       const user = await new Promise((resolve, reject) => {
//         db.get(`
//           SELECT u.*, r.permissions
//           FROM staff_users u
//           LEFT JOIN staff_roles r ON u.role_id = r.id
//           WHERE u.id = ?
//         `, [userId], (err, row) => {
//           if (err) reject(err);
//           else resolve(row);
//         });
//       });

//       if (!user) {
//         return res.status(404).json({
//           success: false,
//           message: 'User not found.'
//         });
//       }

//       // Parse permissions (stored as JSON string)
//       let userPermissions = [];
//       try {
//         userPermissions = user.permissions ? JSON.parse(user.permissions) : [];
//       } catch (e) {
//         userPermissions = [];
//       }

//       // Check if user has the required permission
//       if (!userPermissions.includes(requiredPermission)) {
//         return res.status(403).json({
//           success: false,
//           message: `Access denied. Required permission: ${requiredPermission}`
//         });
//       }

//       next();
//     } catch (error) {
//       console.error('Permission check error:', error);
//       return res.status(500).json({
//         success: false,
//         message: 'Error checking permissions.'
//       });
//     }
//   };
// };

// Middleware to check if user has any of the required permissions
// const checkAnyPermission = (permissions) => {
//   return async (req, res, next) => {
//     try {
//       const userId = req.user.userId;
//       const userRole = req.user.role;

//       // Super admin has all permissions
//       if (userRole === 'super_admin') {
//         return next();
//       }

//       // Get user's permissions from database
//       const db = req.app.locals.db;

//       const user = await new Promise((resolve, reject) => {
//         db.get(`
//           SELECT u.*, r.permissions
//           FROM staff_users u
//           LEFT JOIN staff_roles r ON u.role_id = r.id
//           WHERE u.id = ?
//         `, [userId], (err, row) => {
//           if (err) reject(err);
//           else resolve(row);
//         });
//       });

//       if (!user) {
//         return res.status(404).json({
//           success: false,
//           message: 'User not found.'
//         });
//       }

//       // Parse permissions
//       let userPermissions = [];
//       try {
//         userPermissions = user.permissions ? JSON.parse(user.permissions) : [];
//       } catch (e) {
//         userPermissions = [];
//       }

//       // Check if user has any of the required permissions
//       const hasPermission = permissions.some(perm => userPermissions.includes(perm));

//       if (!hasPermission) {
//         return res.status(403).json({
//           success: false,
//           message: `Access denied. Required one of: ${permissions.join(', ')}`
//         });
//       }

//       next();
//     } catch (error) {
//       console.error('Permission check error:', error);
//       return res.status(500).json({
//         success: false,
//         message: 'Error checking permissions.'
//       });
//     }
//   };
// };

// Middleware to check if user has a specific role
// const checkRole = (allowedRoles) => {
//   return (req, res, next) => {
//     const userRole = req.user.role;

//     if (!allowedRoles.includes(userRole)) {
//       return res.status(403).json({
//         success: false,
//         message: 'Access denied. Insufficient role privileges.'
//       });
//     }

//     next();
//   };
// };

// middleware/permissions.js
// requirePermission('products:create')
function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.staffUser)
      return res.status(401).json({ error: "Not authenticated" });

    // super quick protected user -> allow everything
    if (req.staffUser.isProtected) return next();

    // collect permissions from roles
    const perm = await roleModel.findOne({ name: req.staffUser.role });
    if (!perm) {
      return res.status(403).json({ error: "Role not found" });
    }

    if (perm.active === false) {
      return res.status(403).json({ message: "Role is inactive" });
    }

    if (
      perm.permissions.includes("*") ||
      perm.permissions.includes(permission)
    ) {
      return next();
    }

    return res.status(403).json({ error: "Forbidden" });
  };
}

function requireRole(roleNames = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const names = (req.user.roles || []).map((r) => r.name);
    if (names.includes("super_admin")) return next();
    if (roleNames.some((rn) => names.includes(rn))) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}

module.exports = {
  verifyStaffUsersToken,
  requirePermission,
  requireRole,
  JWT_SECRET,
};

// module.exports = {
//   verifyStaffUsersToken,
//   checkPermission,
//   checkAnyPermission,
//   checkRole,
//   JWT_SECRET
// };
