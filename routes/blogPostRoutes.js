const express = require("express");
const {
  createBlog,
  getAllBlogs,
  deleteBlog,
  getBlogById,
  writeCommentOnBlog,
  updateBlog,
  toggleBlogLike,
  replyToComment,
  toggleActiveStatusOfBlog,
  deleteBlogsBulk,
  getBlogBySlug,
} = require("../controllers/blogPostController");
const { verifyAdminToken } = require("../middleware/authMiddleware");
const { requirePermission, verifyStaffUsersToken } = require("../middleware/rbac-middleware");
const router = express.Router();

// router.post("/add-blog" , verifyAdminToken , addBlogPost)

router.post("/add-blog", verifyStaffUsersToken, requirePermission('blogs:create'), createBlog);

// Get all blogs with filtering, sorting & pagination
router.get("/all-blogs", getAllBlogs);

// Bulk delete blogs
router.post(
  "/delete-blogs/bulk",
  verifyStaffUsersToken,
  requirePermission("blogs:delete"),
  deleteBlogsBulk
);

//Delete a Blog
router.post("/delete-blog/:id", verifyStaffUsersToken, requirePermission('blogs:delete'), deleteBlog);

// PATCH - Toggle blog active status
router.patch('/blog/:id/toggle-active', verifyStaffUsersToken, requirePermission('blogs:update'), toggleActiveStatusOfBlog )

// Get a blog by id
router.get("/blog/:id", getBlogById);

// Get a blog by slug
router.get("/blog/slug/:slug", getBlogBySlug);

//Write a comment
router.post("/blog/:id/comment", writeCommentOnBlog);

router.post("/blogs/:blogId/comments/:commentId/reply", replyToComment);

// POST /blogs/:blogId/comments/:commentId/reply



// Update Blog - FIXED to handle both ID types
router.put("/update-blog/:id", verifyStaffUsersToken, requirePermission('blogs:update'), updateBlog);

//Toggle Like
router.post("/blog/:id/like", toggleBlogLike);

module.exports = router;
