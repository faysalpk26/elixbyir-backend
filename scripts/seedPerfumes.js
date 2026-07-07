/**
 * seedPerfumes.js
 * ---------------
 * Clears old products from MongoDB and inserts the perfume catalog
 * from mock-allproducts.json.
 *
 * Run with:  node scripts/seedPerfumes.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/productModel");
const mockData = require("../mock-allproducts.json");

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
    console.log("✅ Connected to MongoDB");

    // 1. Delete all existing products
    const deleteResult = await Product.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} old products`);

    // 2. Prepare the perfume products
    const perfumes = mockData.products.map((p) => ({
      id: p.id,
      name: p.name,
      category: "Fragrance",
      brand: p.brand || p.name,
      sku: p.sku || `PERF-${p.id}`,
      description: p.description,
      short_description: p.short_description || "",
      image: p.image,
      images: p.images || [p.image],
      new_price: p.new_price,
      old_price: p.old_price,
      discount_type: "percentage",
      discount_value: 0,
      features: p.features || [],
      specifications: p.specifications || [],
      materials: p.materials || "",
      care_instructions: p.care_instructions || "",
      size_chart: p.size_chart || "",
      colors: p.colors || [],
      sizes: p.sizes || [],
      weight: p.weight || 100,
      dimensions: p.dimensions || { length: 0, width: 0, height: 0 },
      stock_quantity: 100,
      status: "published",
      available: true,
      featured: p.id <= 6,
    }));

    // 3. Insert all perfumes
    const insertResult = await Product.insertMany(perfumes);
    console.log(`✅ Inserted ${insertResult.length} perfume products`);

    // 4. Show a quick preview
    console.log("\n📦 Sample of inserted products:");
    insertResult.slice(0, 3).forEach((p) => {
      console.log(`  - [${p.id}] ${p.name} | $${p.new_price} | ${p.category}`);
    });

    console.log("\n🎉 Seed complete! Your backend now has perfume data.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
