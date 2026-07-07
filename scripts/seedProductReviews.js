require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/productModel");
const ProductReview = require("../models/productReviewModel");

const sampleUsers = [
  {
    name: "Ayesha Malik",
    email: "ayesha.malik@example.com",
    avatar: "https://placehold.co/64x64/FDE2E4/9F1239?text=AM",
  },
  {
    name: "Sara Khan",
    email: "sara.khan@example.com",
    avatar: "https://placehold.co/64x64/FDE7F0/9F1239?text=SK",
  },
  {
    name: "Noor Hassan",
    email: "noor.hassan@example.com",
    avatar: "https://placehold.co/64x64/FCE7F3/9F1239?text=NH",
  },
  {
    name: "Fatima Iqbal",
    email: "fatima.iqbal@example.com",
    avatar: "https://placehold.co/64x64/FFE4F1/9F1239?text=FI",
  },
  {
    name: "Hira Aziz",
    email: "hira.aziz@example.com",
    avatar: "https://placehold.co/64x64/FDE2F1/9F1239?text=HA",
  },
  {
    name: "Zara Sheikh",
    email: "zara.sheikh@example.com",
    avatar: "https://placehold.co/64x64/FCE7F3/9F1239?text=ZS",
  },
  {
    name: "Aqsa Ali",
    email: "aqsa.ali@example.com",
    avatar: "https://placehold.co/64x64/FDE7F0/9F1239?text=AA",
  },
  {
    name: "Maha Raza",
    email: "maha.raza@example.com",
    avatar: "https://placehold.co/64x64/FFE4F1/9F1239?text=MR",
  },
];

const reviewTitles = [
  "Beautiful quality",
  "Great fit and finish",
  "Exactly what I wanted",
  "Lovely and comfortable",
  "Worth the price",
  "Will buy again",
  "Stylish and easy to wear",
  "Nice details",
];

const reviewComments = [
  "The fabric feels soft and the stitching is clean. Looks even better in person.",
  "Fits true to size and sits perfectly. The color is very flattering.",
  "Comfortable for all-day wear. I received compliments the first time I wore it.",
  "The quality exceeded my expectations. Packaging was neat too.",
  "Great value and very versatile. Pairs well with basics in my wardrobe.",
  "Lightweight but structured in the right places. Easy to style up or down.",
  "The details are thoughtful and it feels premium. Would recommend.",
  "Exactly as described. I will likely purchase another color.",
];

const ratingPool = [5, 5, 5, 4, 4, 5, 4, 5];

function buildReviewsForProduct(productId, count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const user = sampleUsers[i % sampleUsers.length];
    const title = reviewTitles[i % reviewTitles.length];
    const comment = reviewComments[i % reviewComments.length];
    const rating = ratingPool[i % ratingPool.length];
    return {
      productId,
      userId: `seed-user-${productId}-${i + 1}`,
      userName: user.name,
      userEmail: user.email,
      userAvatar: user.avatar,
      rating,
      title,
      comment,
      isVerifiedPurchase: i % 2 === 0,
      status: "published",
      createdAt: new Date(Date.now() - (i + 1) * 86400000),
      updatedAt: new Date(Date.now() - (i + 1) * 86400000),
    };
  });
}

async function seedProductReviews() {
  await mongoose.connect(process.env.MONGODB_URI);

  const products = await Product.find({}, { id: 1, name: 1 });
  const productIds = products.map((product) => product.id);

  await ProductReview.deleteMany({ productId: { $in: productIds } });

  const allReviews = [];
  products.forEach((product) => {
    allReviews.push(...buildReviewsForProduct(product.id, 6));
  });

  if (allReviews.length) {
    await ProductReview.insertMany(allReviews);
  }

  console.log(`Seeded ${allReviews.length} product reviews`);
  process.exit(0);
}

seedProductReviews().catch((error) => {
  console.error("Product review seeding failed:", error);
  process.exit(1);
});
