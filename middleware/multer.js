const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_ROOT = path.join(__dirname, "../upload");

function fileFilter(req, file, cb) {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid image type"));
  }
}


//Product Image Upload

const productUploadDir = path.join(UPLOAD_ROOT, "images");
if (!fs.existsSync(productUploadDir)) {
  fs.mkdirSync(productUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: productUploadDir,
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });



// Category Image Upload

const categoryUploadDir = path.join(UPLOAD_ROOT, "categories");
if (!fs.existsSync(categoryUploadDir)) {
  fs.mkdirSync(categoryUploadDir, { recursive: true });
}

const categoryStorage = multer.diskStorage({
  destination: categoryUploadDir,
  filename: (req, file, cb) => {
    cb(null, `category_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const categoryImageUpload = multer({
  storage: categoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});





// =============================================
// Blog CATEGORY IMAGE UPLOAD
// =============================================
const blogCategoryUploadDir = path.join(UPLOAD_ROOT, "blog-categories");
if (!fs.existsSync(blogCategoryUploadDir)) {
  fs.mkdirSync(blogCategoryUploadDir, { recursive: true });
}

const blogCategoryStorage = multer.diskStorage({
  destination: blogCategoryUploadDir,
  filename: (req, file, cb) => {
    cb(null, `category_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const blogCategoryImageUpload = multer({
  storage: blogCategoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});




// =============================================
// Blog  IMAGE UPLOAD
// =============================================

const blogUploadDir = path.join(UPLOAD_ROOT, "blog");
if (!fs.existsSync(blogUploadDir)) {
  fs.mkdirSync(blogUploadDir, { recursive: true });
}

const blogStorage = multer.diskStorage({
  destination: blogUploadDir,
  filename: (req, file, cb) => {
    cb(null, `blog_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const blogImageUpload = multer({
  storage: blogStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});






module.exports = {
    upload,
    categoryImageUpload,
    blogCategoryImageUpload,
    blogImageUpload
}

