// FIXED: RBAC Routes for Pink Dreams Store - With Proper Database Handling
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyToken, checkPermission, checkRole, JWT_SECRET } = require('../middleware/rbac-middleware');

// All available permissions in the system
const ALL_PERMISSIONS = [
  // Product Management
  'products.view',
  'products.create',
  'products.edit',
  'products.delete',
  
  // Order Management
  'orders.view',
  'orders.edit',
  'orders.delete',
  
  // Category Management
  'categories.view',
  'categories.create',
  'categories.edit',
  'categories.delete',
  
  // Promo Code Management
  'promocodes.view',
  'promocodes.create',
  'promocodes.edit',
  'promocodes.delete',
  
  // Contact/Message Management
  'contacts.view',
  'contacts.delete',
  
  // Staff Management (admin only)
  'staff.view',
  'staff.create',
  'staff.edit',
  'staff.delete',
  
  // Role Management (admin only)
  'roles.view',
  'roles.create',
  'roles.edit',
  'roles.delete',
  
  // Analytics & Reports
  'analytics.view',
  'reports.view',
  
  // System Settings
  'settings.view',
  'settings.edit'
];

// ============================================
// HELPER FUNCTIONS FOR DATABASE OPERATIONS
// ============================================

// Promisified database run operation with proper error handling
const dbRun = (db, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('❌ Database error:', err.message);
        console.error('SQL:', sql);
        console.error('Params:', params);
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
};

// Promisified database get operation
const dbGet = (db, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('❌ Database error:', err.message);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Promisified database all operation
const dbAll = (db, sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('❌ Database error:', err.message);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Initialize RBAC tables
const initRBACTables = (db) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Staff Roles Table
      db.run(`
        CREATE TABLE IF NOT EXISTS staff_roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          description TEXT,
          permissions TEXT DEFAULT '[]',
          is_system_role INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('Error creating staff_roles table:', err);
      });

      // Staff Users Table
      db.run(`
        CREATE TABLE IF NOT EXISTS staff_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          full_name TEXT NOT NULL,
          role_id INTEGER,
          is_active INTEGER DEFAULT 1,
          last_login DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (role_id) REFERENCES staff_roles(id)
        )
      `, (err) => {
        if (err) console.error('Error creating staff_users table:', err);
      });

      // Activity Logs Table
      db.run(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action TEXT NOT NULL,
          resource TEXT,
          resource_id INTEGER,
          details TEXT,
          ip_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES staff_users(id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating activity_logs table:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

// Seed default roles
const seedDefaultRoles = async (db) => {
  const defaultRoles = [
    {
      name: 'super_admin',
      display_name: 'Super Administrator',
      description: 'Full system access with all permissions',
      permissions: ALL_PERMISSIONS,
      is_system_role: 1
    },
    {
      name: 'admin',
      display_name: 'Administrator',
      description: 'Administrative access with most permissions',
      permissions: [
        'products.view', 'products.create', 'products.edit', 'products.delete',
        'orders.view', 'orders.edit', 'orders.delete',
        'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
        'promocodes.view', 'promocodes.create', 'promocodes.edit', 'promocodes.delete',
        'contacts.view', 'contacts.delete',
        'analytics.view', 'reports.view'
      ],
      is_system_role: 1
    },
    {
      name: 'manager',
      display_name: 'Store Manager',
      description: 'Manage products, orders, and view analytics',
      permissions: [
        'products.view', 'products.create', 'products.edit',
        'orders.view', 'orders.edit',
        'categories.view',
        'promocodes.view',
        'analytics.view'
      ],
      is_system_role: 1
    },
    {
      name: 'staff',
      display_name: 'Staff Member',
      description: 'Basic staff access to view and process orders',
      permissions: [
        'products.view',
        'orders.view', 'orders.edit',
        'categories.view'
      ],
      is_system_role: 1
    },
    {
      name: 'viewer',
      display_name: 'Viewer',
      description: 'Read-only access to view data',
      permissions: [
        'products.view',
        'orders.view',
        'categories.view',
        'analytics.view'
      ],
      is_system_role: 1
    }
  ];

  for (const role of defaultRoles) {
    try {
      const existing = await dbGet(db, 'SELECT id FROM staff_roles WHERE name = ?', [role.name]);
      
      if (!existing) {
        await dbRun(db, `
          INSERT INTO staff_roles (name, display_name, description, permissions, is_system_role)
          VALUES (?, ?, ?, ?, ?)
        `, [role.name, role.display_name, role.description, JSON.stringify(role.permissions), role.is_system_role]);
        
        undefined;
      }
    } catch (error) {
      console.error(`Error seeding role ${role.name}:`, error);
    }
  }
};

// Create default super admin
const createDefaultSuperAdmin = async (db) => {
  try {
    const existing = await dbGet(db, 'SELECT id FROM staff_users WHERE username = ?', ['admin']);
    
    if (!existing) {
      const role = await dbGet(db, 'SELECT id FROM staff_roles WHERE name = ?', ['super_admin']);
      
      if (role) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await dbRun(db, `
          INSERT INTO staff_users (username, email, password, full_name, role_id)
          VALUES (?, ?, ?, ?, ?)
        `, ['admin', 'admin@pinkdreams.com', hashedPassword, 'System Administrator', role.id]);
        
        undefined;
      }
    }
  } catch (error) {
    console.error('Error creating default super admin:', error);
  }
};

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Staff login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = req.app.locals.db;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required.' 
      });
    }

    // Get user with their role
    const user = await dbGet(db, `
      SELECT u.*, r.name as role_name, r.display_name as role_display, r.permissions
      FROM staff_users u
      LEFT JOIN staff_roles r ON u.role_id = r.id
      WHERE u.username = ?
    `, [username]);

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password.' 
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is deactivated. Please contact administrator.' 
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password.' 
      });
    }

    // Update last login
    await dbRun(db, 'UPDATE staff_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Log activity
    await dbRun(db, `
      INSERT INTO activity_logs (user_id, action, details, ip_address)
      VALUES (?, ?, ?, ?)
    `, [user.id, 'login', 'User logged in', req.ip || req.connection.remoteAddress]);

    // Create JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role_name,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role_name,
        role_display: user.role_display,
        permissions: JSON.parse(user.permissions || '[]')
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login.' 
    });
  }
});

// Verify token and get current user
router.get('/me', verifyToken, async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const user = await dbGet(db, `
      SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.last_login,
             r.name as role_name, r.display_name as role_display, r.permissions
      FROM staff_users u
      LEFT JOIN staff_roles r ON u.role_id = r.id
      WHERE u.id = ?
    `, [req.user.userId]);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    res.json({
      success: true,
      user: {
        ...user,
        permissions: JSON.parse(user.permissions || '[]')
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user data.' 
    });
  }
});

// ============================================
// ROLE MANAGEMENT ROUTES
// ============================================

// Get all roles
router.get('/roles', verifyToken, checkPermission('roles.view'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const roles = await dbAll(db, `
      SELECT id, name, display_name, description, permissions, is_system_role, created_at, updated_at
      FROM staff_roles
      ORDER BY is_system_role DESC, name ASC
    `);

    res.json({
      success: true,
      roles: roles.map(role => ({
        ...role,
        permissions: JSON.parse(role.permissions || '[]')
      }))
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching roles.' 
    });
  }
});

// Get single role
router.get('/roles/:id', verifyToken, checkPermission('roles.view'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const role = await dbGet(db, `
      SELECT * FROM staff_roles WHERE id = ?
    `, [req.params.id]);

    if (!role) {
      return res.status(404).json({ 
        success: false, 
        message: 'Role not found.' 
      });
    }

    res.json({
      success: true,
      role: {
        ...role,
        permissions: JSON.parse(role.permissions || '[]')
      }
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching role.' 
    });
  }
});

// Create new role
router.post('/roles', verifyToken, checkPermission('roles.create'), async (req, res) => {
  try {
    const { name, display_name, description, permissions } = req.body;
    const db = req.app.locals.db;

    if (!name || !display_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and display name are required.' 
      });
    }

    const permissionsJson = JSON.stringify(permissions || []);

    const result = await dbRun(db, `
      INSERT INTO staff_roles (name, display_name, description, permissions)
      VALUES (?, ?, ?, ?)
    `, [name, display_name, description, permissionsJson]);

    // Log activity
    await dbRun(db, `
      INSERT INTO activity_logs (user_id, action, resource, resource_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [req.user.userId, 'create', 'role', result.lastID, `Created role: ${name}`]);

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      roleId: result.lastID
    });
  } catch (error) {
    console.error('Error creating role:', error);
    
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Role name already exists.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error creating role.' 
    });
  }
});

// Update role
router.put('/roles/:id', verifyToken, checkPermission('roles.edit'), async (req, res) => {
  try {
    const { display_name, description, permissions } = req.body;
    const db = req.app.locals.db;

    // Check if role exists and if it's a system role
    const role = await dbGet(db, 'SELECT is_system_role, name FROM staff_roles WHERE id = ?', [req.params.id]);

    if (!role) {
      return res.status(404).json({ 
        success: false, 
        message: 'Role not found.' 
      });
    }

    const permissionsJson = JSON.stringify(permissions || []);

    await dbRun(db, `
      UPDATE staff_roles 
      SET display_name = ?, description = ?, permissions = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [display_name, description, permissionsJson, req.params.id]);

    // Log activity
    await dbRun(db, `
      INSERT INTO activity_logs (user_id, action, resource, resource_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [req.user.userId, 'update', 'role', req.params.id, `Updated role: ${role.name}`]);

    res.json({
      success: true,
      message: 'Role updated successfully'
    });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating role.' 
    });
  }
});

// Delete role
router.delete('/roles/:id', verifyToken, checkPermission('roles.delete'), async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Check if it's a system role
    const role = await dbGet(db, 'SELECT is_system_role, name FROM staff_roles WHERE id = ?', [req.params.id]);

    if (!role) {
      return res.status(404).json({ 
        success: false, 
        message: 'Role not found.' 
      });
    }

    if (role.is_system_role) {
      return res.status(403).json({ 
        success: false, 
        message: 'Cannot delete system roles.' 
      });
    }

    // Check if any users have this role
    const usersWithRole = await dbGet(db, 'SELECT COUNT(*) as count FROM staff_users WHERE role_id = ?', [req.params.id]);

    if (usersWithRole && usersWithRole.count > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete role. ${usersWithRole.count} user(s) are assigned to this role.` 
      });
    }

    await dbRun(db, 'DELETE FROM staff_roles WHERE id = ?', [req.params.id]);

    // Log activity
    await dbRun(db, `
      INSERT INTO activity_logs (user_id, action, resource, resource_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [req.user.userId, 'delete', 'role', req.params.id, `Deleted role: ${role.name}`]);

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting role.' 
    });
  }
});

// ============================================
// STAFF USERS MANAGEMENT ROUTES
// ============================================

// Get all staff users
router.get('/staff', verifyToken, checkPermission('staff.view'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const users = await dbAll(db, `
      SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.last_login, u.created_at,
             r.name as role_name, r.display_name as role_display
      FROM staff_users u
      LEFT JOIN staff_roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
    `);

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching staff users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching staff users.' 
    });
  }
});

// Get single staff user
router.get('/staff/:id', verifyToken, checkPermission('staff.view'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    const user = await dbGet(db, `
      SELECT u.id, u.username, u.email, u.full_name, u.is_active, u.last_login, u.created_at, u.role_id,
             r.name as role_name, r.display_name as role_display, r.permissions
      FROM staff_users u
      LEFT JOIN staff_roles r ON u.role_id = r.id
      WHERE u.id = ?
    `, [req.params.id]);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    res.json({
      success: true,
      user: {
        ...user,
        permissions: JSON.parse(user.permissions || '[]')
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching user.' 
    });
  }
});

// Create new staff user
router.post('/staff', verifyToken, checkPermission('staff.create'), async (req, res) => {
  try {
    const { username, email, password, full_name, role_id } = req.body;
    const db = req.app.locals.db;

    if (!username || !email || !password || !full_name || !role_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required.' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await dbRun(db, `
      INSERT INTO staff_users (username, email, password, full_name, role_id)
      VALUES (?, ?, ?, ?, ?)
    `, [username, email, hashedPassword, full_name, role_id]);

    // Log activity
    await dbRun(db, `
      INSERT INTO activity_logs (user_id, action, resource, resource_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [req.user.userId, 'create', 'staff_user', result.lastID, `Created user: ${username}`]);

    res.status(201).json({
      success: true,
      message: 'Staff user created successfully',
      userId: result.lastID
    });
  } catch (error) {
    console.error('Error creating staff user:', error);
    
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username or email already exists.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error creating user.' 
    });
  }
});

// Update staff user
router.put('/staff/:id', verifyToken, checkPermission('staff.edit'), async (req, res) => {
  try {
    const { email, full_name, role_id, is_active, password } = req.body;
    const db = req.app.locals.db;

    let query = `
      UPDATE staff_users 
      SET email = ?, full_name = ?, role_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    `;
    let params = [email, full_name, role_id, is_active ? 1 : 0];

    // If password is provided, update it
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += `, password = ?`;
      params.push(hashedPassword);
    }

    query += ` WHERE id = ?`;
    params.push(req.params.id);

    await dbRun(db, query, params);

    // Log activity
    await dbRun(db, `
      INSERT INTO activity_logs (user_id, action, resource, resource_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [req.user.userId, 'update', 'staff_user', req.params.id, 'Updated staff user']);

    res.json({
      success: true,
      message: 'Staff user updated successfully'
    });
  } catch (error) {
    console.error('Error updating staff user:', error);
    
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already exists.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Error updating user.' 
    });
  }
});

// Delete staff user
router.delete('/staff/:id', verifyToken, checkPermission('staff.delete'), async (req, res) => {
  try {
    const db = req.app.locals.db;

    // Prevent deleting yourself
    if (parseInt(req.params.id) === req.user.userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete your own account.' 
      });
    }

    // Get user info before deleting
    const user = await dbGet(db, 'SELECT username FROM staff_users WHERE id = ?', [req.params.id]);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    await dbRun(db, 'DELETE FROM staff_users WHERE id = ?', [req.params.id]);

    // Log activity
    await dbRun(db, `
      INSERT INTO activity_logs (user_id, action, resource, resource_id, details)
      VALUES (?, ?, ?, ?, ?)
    `, [req.user.userId, 'delete', 'staff_user', req.params.id, `Deleted user: ${user.username}`]);

    res.json({
      success: true,
      message: 'Staff user deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting staff user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting user.' 
    });
  }
});

// ============================================
// ACTIVITY LOGS ROUTES
// ============================================

// Get activity logs with pagination
router.get('/activity-logs', verifyToken, checkPermission('staff.view'), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { limit = 20, offset = 0 } = req.query;
    
    const logs = await dbAll(db, `
      SELECT 
        al.*,
        u.username,
        u.full_name
      FROM activity_logs al
      LEFT JOIN staff_users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching activity logs.' 
    });
  }
});

// Get available permissions
router.get('/permissions', verifyToken, (req, res) => {
  res.json({
    success: true,
    permissions: ALL_PERMISSIONS
  });
});

module.exports = {
  router,
  initRBACTables,
  seedDefaultRoles,
  createDefaultSuperAdmin,
  ALL_PERMISSIONS
};