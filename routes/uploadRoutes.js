const express = require("express");
const {
  uploadBlogImageController,
  uploadBlogCategoryImageController,
  uploadAuthorProfileImageController,
  uploadCategoryImageController,
  uploadProductImageController,
  uploadBulkProductImagesController,
} = require("../controllers/uploadController");
const { blogImageUpload, blogCategoryImageUpload, categoryImageUpload, upload } = require("../middleware/multer");
const  uploadMulterTemp  = require("../utils/multerTemp");
const { verifyStaffUsersToken, requirePermission } = require("../middleware/rbac-middleware");
const router = express.Router();

// router.post( "/upload/blog-image",
//   blogImageUpload.single("blogImage"),
//     uploadBlogImageController
// );
router.post( "/upload/blog-image",
  uploadMulterTemp.single("blogImage"),
  verifyStaffUsersToken, requirePermission('blogs:update'),
    uploadBlogImageController
);

router.post( "/upload/author-profile-image",
  uploadMulterTemp.single("authorProfileImage"),
  verifyStaffUsersToken, requirePermission('blogs:update'),
    uploadAuthorProfileImageController
);

// Blog Category Image Upload Endpoint
router.post( "/upload/blog-category-image",
  uploadMulterTemp.single("blogCategoryImage"),
  verifyStaffUsersToken, requirePermission('blogCategories:update'),
  uploadBlogCategoryImageController
);

// Category Image Upload Endpoint
router.post(
  "/upload/category-image",
  categoryImageUpload.single("categoryImage"),
  verifyStaffUsersToken, requirePermission('categories:update'),
  uploadCategoryImageController
);

router.post("/upload", upload.single("product"), verifyStaffUsersToken, requirePermission('products:update'),uploadProductImageController );
router.post(
  "/upload/product-bulk-urls",
  uploadMulterTemp.array("products", 40),
  verifyStaffUsersToken,
  requirePermission("products:create"),
  uploadBulkProductImagesController,
);


module.exports = router;
