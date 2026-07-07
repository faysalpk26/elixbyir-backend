require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Role = require('../models/roleModel');
const StaffUser = require('../models/staffUsersModel');

/* -------------------- PERMISSIONS -------------------- */

const PERMISSIONS = {
  PRODUCTS: ['products:create', 'products:read', 'products:update', 'products:delete'],
  BLOGS: ['blogs:create', 'blogs:read', 'blogs:update', 'blogs:delete'],
  CATEGORIES: ['categories:create', 'categories:read', 'categories:update', 'categories:delete'],
  BLOG_CATEGORIES: ['blogCategories:create', 'blogCategories:read', 'blogCategories:update', 'blogCategories:delete'],
  ORDERS: ['orders:create', 'orders:read', 'orders:update', 'orders:delete'],
  PROMO_CODES: ['promoCodes:create', 'promoCodes:read', 'promoCodes:update', 'promoCodes:delete'],
  ANALYTICS: ['analytics:read'],
  WISHLISTS: ['wishlists:read'],
  NOTIFICATIONS: ['notifications:read'],
  SETTINGS: ['settings:create', 'settings:read', 'settings:update', 'settings:delete'],
  ROLES: ['roles:create', 'roles:read', 'roles:update', 'roles:delete'],
  CONTACTS: ['contacts:create', 'contacts:read', 'contacts:update', 'contacts:delete'],
  TEAM: ['team:create', 'team:read', 'team:update', 'team:delete'],
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS).flat();

/* -------------------- FUNCTIONS -------------------- */

async function seedRoles() {
  undefined;

  const roles = [
    {
      name: 'Super Admin',
      permissions: ALL_PERMISSIONS,
      description: 'Full system access',
      protected: true,
      active : true
    },
    {
      name: 'Admin',
      permissions: [
        ...PERMISSIONS.PRODUCTS,
        // ...PERMISSIONS.BLOGS,
        ...PERMISSIONS.CATEGORIES,
        ...PERMISSIONS.BLOG_CATEGORIES,
        // ...PERMISSIONS.ORDERS,
        ...PERMISSIONS.PROMO_CODES,
        ...PERMISSIONS.ANALYTICS,
        ...PERMISSIONS.WISHLISTS,
        ...PERMISSIONS.NOTIFICATIONS,
      ],
      description: 'Platform administrator',
      active : true
    },
    // {
    //   name: 'manager',
    //   permissions: [
    //     ...PERMISSIONS.ORDERS,
    //     'products:read',
    //     'products:update',
    //   ],
    //   description: 'Order & product manager',
    // },
    // {
    //   name: 'editor',
    //   permissions: [
    //     ...PERMISSIONS.BLOGS,
    //     ...PERMISSIONS.BLOG_CATEGORIES,
    //   ],
    //   description: 'Blog & content editor',
    // },
    // {
    //   name: 'customer',
    //   permissions: ['products:read', 'orders:create', 'orders:read'],
    //   description: 'Default customer role',
    // },
  ];

  await Role.deleteMany({});
  await Role.insertMany(roles);

  undefined;
}

async function seedSuperAdmin() {
  undefined;

//   const { SUPERADMIN_EMAIL, SUPERADMIN_PW } = process.env;


 const SUPERADMIN_EMAIL = "admin@gmail.com";
 const SUPERADMIN_PW = "admin123";
  if (!SUPERADMIN_EMAIL || !SUPERADMIN_PW) {
    throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PW must be set');
  }

//   const superRole = await Role.findOne({ name: 'super_admin' });
//   if (!superRole) throw new Error('super_admin role not found');

  const passwordHash = await bcrypt.hash(SUPERADMIN_PW, 10);

  await StaffUser.deleteOne({ email: SUPERADMIN_EMAIL });

  const user = await StaffUser.create({
    email: SUPERADMIN_EMAIL,
    password : passwordHash,
    role: "Super Admin",
    isProtected: true,
    status: 'active',
  });

  undefined;
}

module.exports = {
    seedRoles,
    seedSuperAdmin
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  await seedRoles();
  await seedSuperAdmin();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
