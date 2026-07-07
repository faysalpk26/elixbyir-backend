require('dotenv').config();
const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const models = [
  { name: 'Admin', require: './models/adminModel.js', prismaName: 'admin' },
  { name: 'BlogCategory', require: './models/blogCategoryModel.js', prismaName: 'blogCategory' },
  { name: 'BlogPost', require: './models/blogPostModel.js', prismaName: 'blogPost' },
  { name: 'Cart', require: './models/cartModel.js', prismaName: 'cart' },
  { name: 'Category', require: './models/categoryModel.js', prismaName: 'category' },
  { name: 'Contact', require: './models/contactModel.js', prismaName: 'contact' },
  { name: 'Newsletter', require: './models/newsletterModel.js', prismaName: 'newsletter' },
  { name: 'Notification', require: './models/notificationsModel.js', prismaName: 'notification' },
  { name: 'Order', require: './models/orderModel.js', prismaName: 'order' },
  { name: 'Product', require: './models/productModel.js', prismaName: 'product' },
  { name: 'ProductReview', require: './models/productReviewModel.js', prismaName: 'productReview' },
  { name: 'PromoCode', require: './models/promoCodeModel.js', prismaName: 'promoCode' },
  { name: 'Role', require: './models/roleModel.js', prismaName: 'role' },
  { name: 'Sale', require: './models/saleModel.js', prismaName: 'sale' },
  { name: 'Settings', require: './models/settingsModel.js', prismaName: 'settings' },
  { name: 'StaffUser', require: './models/staffUsersModel.js', prismaName: 'staffUser' },
  { name: 'User', require: './models/userModel.js', prismaName: 'user' },
  { name: 'Wishlist', require: './models/wishlistModel.js', prismaName: 'wishlist' }
];

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (let m of models) {
    console.log(`Migrating ${m.name}...`);
    const Model = require(m.require);
    const docs = await Model.find({}).lean();
    
    if (docs.length === 0) {
      console.log(`No records found for ${m.name}`);
      continue;
    }

    let successCount = 0;
    for (let doc of docs) {
      try {
        const prismaData = { ...doc };
        
        // Map _id to id or dbId
        if (prismaData._id) {
            if (m.name === 'Product') {
                prismaData.dbId = prismaData._id.toString();
            } else {
                prismaData.id = prismaData._id.toString();
            }
        }
        delete prismaData._id;
        delete prismaData.__v;

        // Clean undefined values
        Object.keys(prismaData).forEach(key => {
            if (prismaData[key] === undefined) {
                delete prismaData[key];
            }
            // convert objectIds to string for relational arrays if needed
            if (Array.isArray(prismaData[key])) {
                prismaData[key] = prismaData[key].map(item => {
                    if (item && typeof item === 'object' && item._bsontype === 'ObjectID') {
                        return item.toString();
                    }
                    return item;
                });
            }
        });
        
        // Some Prisma fields need to be handled carefully, but let's try direct insertion.
        await prisma[m.prismaName].create({
            data: prismaData
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to migrate record in ${m.name} ID ${doc._id}: ${err.message}`);
      }
    }
    console.log(`Migrated ${successCount}/${docs.length} for ${m.name}`);
  }

  console.log('Migration complete!');
  await mongoose.disconnect();
  await prisma.$disconnect();
}

migrate().catch(console.error);
