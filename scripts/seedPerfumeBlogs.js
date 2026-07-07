require("dotenv").config();
const mongoose = require("mongoose");
const BlogPost = require("../models/blogPostModel");

const PLACEHOLDER_BLOG_IMAGE = "https://placehold.co/1200x800/FFE4F1/9F1239?text=Pink+Dreams+Blog";
const PLACEHOLDER_AUTHOR_IMAGE = "https://placehold.co/200x200/FCE7F3/9F1239?text=Author";

const blogs = [
  {
    title: "Finding Your Signature Scent in 2026",
    slug: "finding-your-signature-scent",
    shortDescription: "Learn how to layer notes, test on skin, and choose a fragrance that feels unmistakably yours.",
    content: "<p>Learn how to layer notes, test on skin, and choose a fragrance that feels unmistakably yours. Finding your signature scent is a journey of self-discovery...</p>",
    image: "/assets/images/products/elix-01.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "Guides",
    tags: ["perfume", "notes", "gifting"],
    featured: true,
    status: "published",
    available: true,
    readTime: 6,
  },
  {
    title: "The Art of Perfume Layering",
    slug: "art-of-perfume-layering",
    shortDescription: "Combine complementary accords to build depth — from bright citrus openings to warm amber bases.",
    content: "<p>Combine complementary accords to build depth — from bright citrus openings to warm amber bases...</p>",
    image: "/assets/images/products/elix-02.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "Fragrance",
    tags: ["layering", "perfume", "tips"],
    featured: true,
    status: "published",
    available: true,
    readTime: 5,
  },
  {
    title: "Morning Rituals That Last All Day",
    slug: "morning-rituals-that-last",
    shortDescription: "Build a calm, elevated routine with scent, texture, and small luxuries that carry through evening.",
    content: "<p>Build a calm, elevated routine with scent, texture, and small luxuries that carry through evening...</p>",
    image: "/assets/images/products/elix-03.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "Lifestyle",
    tags: ["lifestyle", "wellness", "routine"],
    status: "published",
    available: true,
    readTime: 4,
  },
  {
    title: "Understanding Fragrance Families",
    slug: "understanding-fragrance-families",
    shortDescription: "From floral and oriental to woody and fresh — decode the language of perfumery with ease.",
    content: "<p>From floral and oriental to woody and fresh — decode the language of perfumery with ease...</p>",
    image: "/assets/images/products/elix-04.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "Guides",
    tags: ["notes", "education", "perfume"],
    status: "published",
    available: true,
    readTime: 7,
  },
  {
    title: "Spring Collection Preview: Light & Luminous",
    slug: "spring-collection-preview",
    shortDescription: "A first look at airy florals and soft musks crafted for longer days and golden evenings.",
    content: "<p>A first look at airy florals and soft musks crafted for longer days and golden evenings...</p>",
    image: "/assets/images/products/elix-05.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "News",
    tags: ["new arrivals", "seasonal", "collection"],
    featured: true,
    status: "published",
    available: true,
    readTime: 3,
  },
  {
    title: "Summer Scent Trends",
    slug: "summer-scent-trends",
    shortDescription: "Discover the vibrant, fresh notes that are defining this season's olfactory wardrobe.",
    content: "<p>Discover the vibrant, fresh notes that are defining this season's olfactory wardrobe...</p>",
    image: "/assets/images/blog_perfume_bottle.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "News",
    tags: ["trends", "summer", "fresh"],
    status: "published",
    available: true,
    readTime: 4,
  },
  {
    title: "The Science of Vanilla",
    slug: "science-of-vanilla",
    shortDescription: "Why this universally beloved ingredient is much more complex than you think.",
    content: "<p>Why this universally beloved ingredient is much more complex than you think...</p>",
    image: "/assets/images/blog_perfume_ingredients.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "Guides",
    tags: ["ingredients", "vanilla", "education"],
    status: "published",
    available: true,
    readTime: 8,
  },
  {
    title: "Sustainability in Modern Perfumery",
    slug: "sustainability-in-perfumery",
    shortDescription: "How ethical sourcing and eco-conscious packaging are reshaping the industry.",
    content: "<p>How ethical sourcing and eco-conscious packaging are reshaping the industry...</p>",
    image: "/assets/images/products/elix-06.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "News",
    tags: ["sustainability", "industry", "future"],
    status: "published",
    available: true,
    readTime: 6,
  },
  {
    title: "Curating Your Scent Wardrobe",
    slug: "curating-your-scent-wardrobe",
    shortDescription: "A guide to building a versatile collection for every occasion and mood.",
    content: "<p>A guide to building a versatile collection for every occasion and mood...</p>",
    image: "/assets/images/blog_perfume_bottle.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "Guides",
    tags: ["collection", "tips", "perfume"],
    status: "published",
    available: true,
    readTime: 5,
  },
  {
    title: "The Psychology of Smell",
    slug: "the-psychology-of-smell",
    shortDescription: "Exploring the profound connection between scent, memory, and emotion.",
    content: "<p>Exploring the profound connection between scent, memory, and emotion...</p>",
    image: "/assets/images/blog_perfume_ingredients.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "Lifestyle",
    tags: ["psychology", "memory", "wellness"],
    status: "published",
    available: true,
    readTime: 7,
  },
  {
    title: "The Ultimate Holiday Gifting Guide",
    slug: "holiday-gifting-guide",
    shortDescription: "Fail-proof fragrance gifts that your loved ones will cherish.",
    content: "<p>Fail-proof fragrance gifts that your loved ones will cherish...</p>",
    image: "/assets/images/products/elix-01.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "Guides",
    tags: ["gifting", "holiday", "tips"],
    status: "published",
    available: true,
    readTime: 5,
  },
  {
    title: "An Interview with a Master Perfumer",
    slug: "interview-master-perfumer",
    shortDescription: "Insights into the creative process behind our most iconic scents.",
    content: "<p>Insights into the creative process behind our most iconic scents...</p>",
    image: "/assets/images/blog_perfume_bottle.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "News",
    tags: ["interview", "behind the scenes", "creator"],
    status: "published",
    available: true,
    readTime: 10,
  },
  {
    title: "The Rich History of Rose in Perfumery",
    slug: "history-of-rose",
    shortDescription: "From ancient rituals to modern masterpieces, the evolution of a classic note.",
    content: "<p>From ancient rituals to modern masterpieces, the evolution of a classic note...</p>",
    image: "/assets/images/blog_perfume_ingredients.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "Fragrance",
    tags: ["history", "ingredients", "floral"],
    status: "published",
    available: true,
    readTime: 6,
  },
  {
    title: "The Rise of Unisex Fragrances",
    slug: "unisex-fragrances",
    shortDescription: "Breaking down gender boundaries in the modern world of scent.",
    content: "<p>Breaking down gender boundaries in the modern world of scent...</p>",
    image: "/assets/images/products/elix-02.png",
    author: { name: "Pink Dreams Editorial", profileImage: PLACEHOLDER_AUTHOR_IMAGE, bio: "Editorial desk" },
    category: "Lifestyle",
    tags: ["trends", "unisex", "modern"],
    status: "published",
    available: true,
    readTime: 5,
  }
];

async function seedBlogs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Clear all existing posts to ensure clean state
    await BlogPost.deleteMany({});
    
    await BlogPost.insertMany(blogs);
    console.log(`✅ Seeded ${blogs.length} perfume blog posts to DB`);
    process.exit(0);
  } catch(e) {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  }
}

seedBlogs();
