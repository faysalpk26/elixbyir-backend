require("dotenv").config();
const mongoose = require("mongoose");
const BlogPost = require("../models/blogPostModel");

const PLACEHOLDER_BLOG_IMAGE =
  "https://placehold.co/1200x800/FFE4F1/9F1239?text=Pink+Dreams+Blog";
const PLACEHOLDER_AUTHOR_IMAGE =
  "https://placehold.co/200x200/FCE7F3/9F1239?text=Author";

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

const sampleCommentTexts = [
  "Loved the practical tips — already planning my next outfit with these ideas.",
  "The styling breakdown is so clear. Would love a follow-up on accessories too!",
  "This is exactly what I needed for the season. Simple, elegant, and achievable.",
  "Great read! The fabric notes helped me understand why some pieces feel better.",
  "The capsule checklist is going straight into my notes. Super helpful.",
  "Beautifully written and easy to follow. Keep these guides coming!",
  "This felt like advice from a stylist — concise and confident.",
  "I tried one of the combinations today and it worked perfectly.",
  "Appreciate the care tips — my favorite piece looks brand new again.",
  "Such a polished, professional guide. Thank you for sharing.",
];

const makeComments = (startIndex = 0, count = 6) =>
  Array.from({ length: count }, (_, i) => {
    const user = sampleUsers[(startIndex + i) % sampleUsers.length];
    const text =
      sampleCommentTexts[(startIndex + i) % sampleCommentTexts.length];
    return {
      user: {
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      text,
      createdAt: new Date(Date.now() - (i + 1) * 86400000),
    };
  });

const blogs = [
  {
    title: "The Art of Effortless Elegance: Building a Capsule Wardrobe",
    slug: "effortless-elegance-capsule-wardrobe",
    shortDescription:
      "A polished capsule wardrobe saves time and keeps your style consistent. Here’s a practical, modern approach to curating pieces you’ll love wearing on repeat.",
    content: `
<p class='lead'>A capsule wardrobe is not about owning less. It is about owning the right pieces that work together, travel well, and feel effortless every time you get dressed.</p>
<h2>Start with your style anchors</h2>
<p>Before you plan outfits, list the silhouettes you reach for most. Do you prefer tailored trousers, flowy midis, or structured blazers? These shapes become the backbone of your capsule because they already align with your lifestyle.</p>
<ul>
  <li>2-3 elevated tops that pair with everything</li>
  <li>1-2 layers (blazer, cardigan, or light coat)</li>
  <li>2 bottoms that can go casual or polished</li>
  <li>1 statement dress that does the work for you</li>
</ul>
<h2>Create a color system</h2>
<p>A simple palette keeps everything cohesive. Choose one dominant neutral, one soft neutral, and two accent tones. This creates variety without chaos and makes shopping decisions easier.</p>
<blockquote>
  <p>When you can mix any top with any bottom, your wardrobe feels unlimited.</p>
</blockquote>
<h2>Plan for real life</h2>
<p>Map your week: work days, errands, dinners, and weekends. Assign outfits to these moments and check if your capsule supports them. If a piece does not fit your real routine, it does not belong in the capsule.</p>
<h3>Capsule checklist</h3>
<ol>
  <li>Does it match at least 3 other items?</li>
  <li>Is it comfortable for the way you live?</li>
  <li>Can it be dressed up and down?</li>
  <li>Is the fabric durable and easy to care for?</li>
</ol>
<hr />
<p>Capsule wardrobes are about clarity and confidence. When everything aligns, getting dressed feels calm, intentional, and beautiful.</p>
`.trim(),
    image: PLACEHOLDER_BLOG_IMAGE,
    author: {
      name: "Pink Dreams Editorial",
      profileImage: PLACEHOLDER_AUTHOR_IMAGE,
      bio: "A curated editorial desk focused on modern elegance, timeless silhouettes, and thoughtful styling.",
    },
    category: "Style Guides",
    tags: ["capsule wardrobe", "styling", "essentials", "minimal wardrobe"],
    featured: true,
    trending: true,
    status: "published",
    available: true,
    publishedAt: new Date(),
    readTime: 6,
    likes: { count: 128, users: [101, 102, 103] },
    views: 842,
    comments: makeComments(0, 6),
    commentsEnabled: true,
    metaTitle: "Capsule Wardrobe Guide | Pink Dreams",
    metaDescription:
      "Create a refined capsule wardrobe with curated essentials, color strategy, and styling balance.",
    metaKeywords: ["capsule wardrobe", "style guide", "wardrobe essentials"],
  },
  {
    title: "Seasonal Color Stories: Styling Pink Dreams Tones",
    slug: "seasonal-color-stories-pink-dreams",
    shortDescription:
      "Soft blush, rose, and warm neutrals are signature to our aesthetic. Learn how to build outfits around these tones for every season.",
    content: `
<p class='lead'>Color is the quiet signature of great style. Our palette is built around blush, rose, and warm neutrals that translate across every season.</p>
<h2>Build your seasonal palette</h2>
<p>Instead of chasing every trend, choose shades that work with your skin tone and feel timeless. Then adjust the intensity by season.</p>
<table>
  <thead>
    <tr><th>Season</th><th>Primary Tones</th><th>Best Pairings</th></tr>
  </thead>
  <tbody>
    <tr><td>Spring</td><td>Blush, Soft Peach</td><td>Ivory, Light Denim</td></tr>
    <tr><td>Summer</td><td>Rose, Petal Pink</td><td>White, Sand</td></tr>
    <tr><td>Fall</td><td>Dusty Berry, Cocoa</td><td>Camel, Olive</td></tr>
    <tr><td>Winter</td><td>Deep Rose, Plum</td><td>Charcoal, Cream</td></tr>
  </tbody>
</table>
<h2>The 60-30-10 rule</h2>
<p>Use a dominant neutral for 60% of the look, a secondary tone for 30%, and a subtle accent for 10%. The result is balanced, polished, and never overwhelming.</p>
<h3>Texture is your contrast</h3>
<p>Soft palettes need texture to keep them interesting. Mix satin with knit, linen with leather, or matte with a light sheen. This brings depth without changing the palette.</p>
<ul>
  <li>Satin blouse + structured trousers</li>
  <li>Chunky knit + slip skirt</li>
  <li>Textured tweed + soft jersey</li>
</ul>
<blockquote>
  <p>Great color does not shout. It harmonizes.</p>
</blockquote>
<p>Once you build a palette system, your closet becomes easier to style and your outfits look intentionally curated.</p>
`.trim(),
    image: PLACEHOLDER_BLOG_IMAGE,
    author: {
      name: "Areeba Khan",
      profileImage: PLACEHOLDER_AUTHOR_IMAGE,
      bio: "Color stylist and fashion writer exploring modern femininity through palette design.",
    },
    category: "Trends",
    tags: ["color styling", "pink palette", "seasonal looks", "wardrobe color"],
    featured: true,
    trending: false,
    status: "published",
    available: true,
    publishedAt: new Date(Date.now() - 2 * 86400000),
    readTime: 5,
    likes: { count: 94, users: [104, 105] },
    views: 610,
    comments: makeComments(2, 5),
    commentsEnabled: true,
    metaTitle: "Seasonal Color Styling | Pink Dreams",
    metaDescription:
      "Learn how to style blush, rose, and warm neutrals across all seasons with balance and texture.",
    metaKeywords: ["color stories", "seasonal styling", "pink dreams"],
  },
  {
    title: "From Day to Night: Styling One Dress Three Ways",
    slug: "day-to-night-styling-one-dress",
    shortDescription:
      "A single dress can feel completely different with the right layers and accessories. Here are three styling formulas you can repeat.",
    content: `
<p class='lead'>The most versatile piece in your wardrobe is the one you can wear from morning to evening with a few smart switches.</p>
<h2>Look 1: Daytime polish</h2>
<p>Pair your dress with a light cardigan, minimal sneakers, and a soft tote. Keep accessories small and the makeup fresh.</p>
<h2>Look 2: Afternoon refined</h2>
<p>Add a belt to define the waist, switch to block heels, and layer a tailored blazer. This feels professional without feeling stiff.</p>
<h2>Look 3: Evening statement</h2>
<p>Swap to heeled sandals, add a statement clutch, and elevate with bold earrings or a sleek updo. The same dress now feels ready for dinner or a formal event.</p>
<h3>Repeatable formula</h3>
<ol>
  <li>Base piece that fits perfectly</li>
  <li>One structured layer</li>
  <li>One accessory with personality</li>
  <li>One footwear switch</li>
</ol>
<blockquote>
  <p>Styling is not about more clothes. It is about better choices.</p>
</blockquote>
<p>When you build your looks around versatility, you wear your favorites more often and your wardrobe works harder for you.</p>
`.trim(),
    image: PLACEHOLDER_BLOG_IMAGE,
    author: {
      name: "Zainab Tariq",
      profileImage: PLACEHOLDER_AUTHOR_IMAGE,
      bio: "Stylist and fashion educator focused on practical elegance and wardrobe versatility.",
    },
    category: "Style Guides",
    tags: ["styling tips", "wardrobe basics", "day to night"],
    featured: false,
    trending: true,
    status: "published",
    available: true,
    publishedAt: new Date(Date.now() - 4 * 86400000),
    readTime: 4,
    likes: { count: 72, users: [106] },
    views: 512,
    comments: makeComments(4, 6),
    commentsEnabled: true,
    metaTitle: "Day to Night Styling | Pink Dreams",
    metaDescription:
      "Transform a single dress into three polished looks with smart layering and accessories.",
    metaKeywords: ["styling", "dress guide", "versatile outfits"],
  },
  {
    title: "Fabric Matters: Choosing Comfort Without Compromise",
    slug: "fabric-matters-comfort-without-compromise",
    shortDescription:
      "The right fabric changes everything—feel, drape, and longevity. Here’s how to choose pieces that look beautiful and wear even better.",
    content: `
<p class='lead'>Fabric determines how a garment drapes, feels, and lasts. Great style starts with the materials you choose.</p>
<h2>Understand fabric personalities</h2>
<p>Some fabrics breathe, some hold structure, and others shine under light. Knowing the difference helps you shop with intention.</p>
<ul>
  <li><strong>Cotton & Linen:</strong> breathable, crisp, best for daywear</li>
  <li><strong>Satin & Crepe:</strong> elegant drape, ideal for evening</li>
  <li><strong>Knits:</strong> comfort-focused, perfect for layering</li>
  <li><strong>Viscose blends:</strong> soft hand-feel with movement</li>
</ul>
<h2>Check weight and weave</h2>
<p>Lightweight fabrics feel airy but may need lining. Heavier weaves add polish but require warmer weather or structured layering.</p>
<h3>Quick fabric test</h3>
<ol>
  <li>Hold it against the light to check opacity</li>
  <li>Scrunch it lightly to see how it creases</li>
  <li>Run your hand across to feel the finish</li>
</ol>
<blockquote>
  <p>If it feels good on day one, it will likely become a favorite.</p>
</blockquote>
<p>Choosing the right fabric means every outfit looks better and lasts longer with less effort.</p>
`.trim(),
    image: PLACEHOLDER_BLOG_IMAGE,
    author: {
      name: "Pink Dreams Editorial",
      profileImage: PLACEHOLDER_AUTHOR_IMAGE,
      bio: "We cover the textures, finishes, and details that make timeless pieces feel exceptional.",
    },
    category: "Fabric & Care",
    tags: ["fabric guide", "comfort", "wardrobe care"],
    featured: false,
    trending: false,
    status: "published",
    available: true,
    publishedAt: new Date(Date.now() - 6 * 86400000),
    readTime: 5,
    likes: { count: 58, users: [107, 108] },
    views: 430,
    comments: makeComments(1, 5),
    commentsEnabled: true,
    metaTitle: "Fabric Guide | Pink Dreams",
    metaDescription:
      "Understand fabric types and choose pieces that balance comfort, structure, and longevity.",
    metaKeywords: ["fabric", "garment care", "style essentials"],
  },
  {
    title: "Occasion Dressing Guide: Weddings, Brunches, and Beyond",
    slug: "occasion-dressing-guide-weddings-brunches",
    shortDescription:
      "Looking polished is easy with a clear dressing framework. Here’s how to style for every occasion with confidence.",
    content: `
<p class='lead'>Occasion dressing is about intention. The right outfit respects the setting while still feeling like you.</p>
<h2>Weddings</h2>
<p>Choose romantic silhouettes and elevated fabrics. Think satin midis, soft pleats, and refined accessories.</p>
<ul>
  <li>Pastels or rich jewel tones depending on the season</li>
  <li>Elegant heels or sandals</li>
  <li>Statement earrings for subtle glamour</li>
</ul>
<h2>Brunches</h2>
<p>Keep it light and playful. A soft blouse with high-waist trousers or a casual midi dress works perfectly.</p>
<h2>Work events</h2>
<p>Tailoring is your best friend. A blazer set or structured skirt with a refined top always feels polished.</p>
<h2>Evening dinners</h2>
<p>Lean into deeper tones and subtle shine. A sleek dress with minimal accessories is understated and powerful.</p>
<blockquote>
  <p>Occasion style is a balance: elevated but effortless.</p>
</blockquote>
<p>Build a mini occasion capsule so you are never starting from scratch when an invitation arrives.</p>
`.trim(),
    image: PLACEHOLDER_BLOG_IMAGE,
    author: {
      name: "Hafsa Noor",
      profileImage: PLACEHOLDER_AUTHOR_IMAGE,
      bio: "Lifestyle editor specializing in modern occasion dressing and effortless elegance.",
    },
    category: "Occasions",
    tags: ["occasion styling", "wedding outfits", "brunch looks"],
    featured: true,
    trending: true,
    status: "published",
    available: true,
    publishedAt: new Date(Date.now() - 8 * 86400000),
    readTime: 6,
    likes: { count: 140, users: [109, 110, 111] },
    views: 970,
    comments: makeComments(3, 6),
    commentsEnabled: true,
    metaTitle: "Occasion Dressing Guide | Pink Dreams",
    metaDescription:
      "A polished guide to dressing for weddings, brunches, work events, and evening plans.",
    metaKeywords: ["occasion dressing", "event outfits", "style guide"],
  },
  {
    title: "Care & Longevity: Keep Your Favorite Pieces Perfect",
    slug: "care-and-longevity-wardrobe",
    shortDescription:
      "Small care habits make a big difference. Learn how to keep your favorite pieces looking new, season after season.",
    content: `
<p class='lead'>Great wardrobes last when care becomes a habit. Small routines protect fabric, color, and structure.</p>
<h2>Daily care basics</h2>
<ul>
  <li>Air out garments after wearing</li>
  <li>Store knits folded to prevent stretching</li>
  <li>Use a gentle steamer instead of harsh ironing</li>
</ul>
<h2>Weekly care routine</h2>
<ol>
  <li>Sort by fabric weight and wash in cold water</li>
  <li>Use mild detergent for delicate pieces</li>
  <li>Dry flat or hang in shade to avoid fading</li>
</ol>
<h3>Quick fixes that save outfits</h3>
<p>Sew small seams early, replace missing buttons immediately, and treat stains before they set. These small steps keep your wardrobe looking fresh.</p>
<table>
  <thead>
    <tr><th>Issue</th><th>Quick Fix</th></tr>
  </thead>
  <tbody>
    <tr><td>Loose thread</td><td>Trim and secure with a small knot</td></tr>
    <tr><td>Wrinkles</td><td>Steam lightly for a smooth finish</td></tr>
    <tr><td>Fading</td><td>Wash inside-out and avoid direct sun</td></tr>
  </tbody>
</table>
<blockquote>
  <p>Care is not extra effort. It is part of a polished style.</p>
</blockquote>
<p>With consistent care, your favorite pieces stay beautiful season after season.</p>
`.trim(),
    image: PLACEHOLDER_BLOG_IMAGE,
    author: {
      name: "Pink Dreams Editorial",
      profileImage: PLACEHOLDER_AUTHOR_IMAGE,
      bio: "Editorial notes on care, longevity, and timeless wardrobe practices.",
    },
    category: "Fabric & Care",
    tags: ["wardrobe care", "style maintenance", "fabric longevity"],
    featured: false,
    trending: false,
    status: "published",
    available: true,
    publishedAt: new Date(Date.now() - 10 * 86400000),
    readTime: 4,
    likes: { count: 66, users: [112] },
    views: 520,
    comments: makeComments(5, 6),
    commentsEnabled: true,
    metaTitle: "Wardrobe Care & Longevity | Pink Dreams",
    metaDescription:
      "Simple care habits that keep your favorite pieces looking new season after season.",
    metaKeywords: ["wardrobe care", "fabric care", "fashion longevity"],
  },
];

async function seedBlogs() {
  await mongoose.connect(process.env.MONGODB_URI);

  const slugs = blogs.map((blog) => blog.slug);
  await BlogPost.deleteMany({ slug: { $in: slugs } });
  await BlogPost.insertMany(blogs);

  console.log(`✅ Seeded ${blogs.length} blog posts`);
  process.exit(0);
}

seedBlogs().catch((error) => {
  console.error("❌ Blog seeding failed:", error);
  process.exit(1);
});
