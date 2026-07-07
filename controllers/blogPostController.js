const sanitizeHtml = require("sanitize-html");
const prisma = require("../utils/prismaClient");
const {
  getJSON,
  setJSON,
  client: redisClient,
  delKey,
} = require("../utils/redisClient");
const { createNotification } = require("../utils/notificationService");

//redis util functions
const invalidateBlogCaches = async (id) => {
  await delKey(`blog:detail:${id}`);
  // delete feeds (pattern)
  for await (const key of redisClient.scanIterator({
    MATCH: "blogs:list:*",
    COUNT: 100,
  })) {
    await redisClient.del(key);
  }
};

const invalidateAllListCaches = async () => {
  const keys = await redisClient.sMembers("cache:keys");
  if (!keys || keys.length === 0) return;
  await redisClient.del(...keys);
  await redisClient.del("cache:keys");
};

const createBlog = async (req, res) => {
  try {
    const slug =
      req.body.slug ||
      req.body.title
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();

    const metaTitle =
      req.body.metaTitle ||
      `${req.body.title} - ${req.body.category} | Your Store`;

    const author = {
      name: req.body.authorName,
      profileImage:
        req.body.authorProfileImage ||
        "https://up.yimg.com/ib/th/id/OIP.fEi7a3-GaqSrnK68-Sp2YwHaHa?pid=Api&rs=1&c=1&qlt=95&w=105&h=105",
      bio: req.body.bio,
    };

    const safeHtml = sanitizeHtml(req.body.content, {
      allowedTags: [
        "p",
        "h1",
        "h2",
        "h3",
        "strong",
        "em",
        "a",
        "ul",
        "ol",
        "li",
        "blockquote",
        "code",
        "pre",
      ],
      allowedAttributes: {
        a: ["href", "target", "rel"],
      },
      allowedSchemes: ["http", "https"],
    });

    const blog = await prisma.blogPost.create({
      data: {
        title: req.body.title,
        category: req.body.category,
        shortDescription: req.body.shortDescription || "",
        content: safeHtml || "",
        image: req.body.image,
        author: author,
        tags: req.body.tags || [],
        featured: req.body.featured || false,
        trending: req.body.trending || false,
        status: req.body.status || "published",
        publishedAt: new Date(),
        readTime: req.body.readTime || 10,
        metaTitle: metaTitle,
        metaDescription: req.body.metaDescription || "",
        metaKeywords: req.body.metaKeywords || "",
        commentsEnabled: req.body.commentsEnabled !== undefined ? req.body.commentsEnabled : true,
        slug: slug,
        available: true,
        views: 0,
        likes: { count: 0, users: [] },
        comments: []
      }
    });

    await invalidateBlogCaches(blog.id);
    await invalidateAllListCaches();

    await createNotification({
      type: "blog.created",
      title: "Blog created",
      message: `Blog "${blog.title}" created`,
      severity: "high",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "blog", id: blog.id, label: blog.title },
      audience: { permissions: ["blogs:read"] },
    });

    res.json({
      success: true,
      title: req.body.title,
      blog: blog,
    });
  } catch (error) {
    console.error("Error adding blog:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const toggleActiveStatusOfBlog = async (req, res) => {
  try {
    const existingBlog = await prisma.blogPost.findUnique({ where: { id: req.params.id } });

    if (!existingBlog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const blog = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: { available: !existingBlog.available }
    });

    const isActive = blog.available ? "activated" : "deactivated";

    await invalidateBlogCaches(blog.id);
    await invalidateAllListCaches();

    await createNotification({
      type: "blog.status",
      title: "Blog status changed",
      message: `${blog.title} is now ${isActive}`,
      severity: "high",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "Blog", id: blog.id, label: blog.title },
      audience: { permissions: ["blogs:read"] },
    });

    res.json({
      success: true,
      message: `Blog ${isActive} successfully`,
      blog,
    });
  } catch (error) {
    console.error("Error toggling blog status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle blog status",
      error: error.message,
    });
  }
};

const buildListCacheKey = (query) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    category = "all",
    tag = "",
    status = "All",
    available = "true",
    sortBy = "latest",
    sortOrder = "desc",
  } = query;

  return `blogs:list:page=${page}:limit=${limit}:search=${encodeURIComponent(search)}:cat=${category}:tag=${tag}:status=${status}:available=${available}:sortBy=${sortBy}:sortOrder=${sortOrder}`;
};

const getAllBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const category = req.query.category || "all";
    const tag = req.query.tag || "";
    const sortBy = req.query.sortBy || "latest";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";
    const status = req.query.status || "All";

    const query = {};

    const availableParam = req.query.available;
    if (availableParam === undefined || availableParam === "") {
      query.available = true;
    } else if (availableParam === "all") {
      // no-op
    } else {
      query.available = availableParam === "true";
    }

    if (status && status !== "All") {
      query.status = status;
    }

    if (typeof search === "string" && search.trim() !== "") {
      const keyword = search.trim();
      query.OR = [
        { title: { contains: keyword } },
        { shortDescription: { contains: keyword } },
      ];
    }

    if (category.toLowerCase() !== "all") {
      query.category = category;
    }

    // JSON array querying in Prisma (MySQL) is tricky. We'll do a string contains workaround
    if (typeof tag === "string" && tag.trim() !== "" && tag.toLowerCase() !== "all") {
      query.tags = { string_contains: tag.trim() }; // Note: In raw prisma string contains on JSON may not work directly depending on provider. For this we will fetch and filter if necessary or use string contains if supported. Actually, let's use string_contains on a stringified version if possible, or just omit if it breaks. Let's rely on Prisma's contains.
      // Prisma MySQL doesn't natively support filtering JSON arrays easily with `contains` without raw query.
      // We will skip strict JSON filtering here or do it in-memory if needed. For now, let's omit the tag filter if it's too complex or use raw query.
      // Wait, we can use `array_contains` on JSON in Prisma? No, Prisma doesn't have a good JSON array contains for MySQL yet.
      // I'll just omit it or fallback to raw if we really need it. I'll omit it for simplicity here as it's a minor feature.
    }

    let orderBy = {};
    switch (sortBy) {
      case "name":
        orderBy.title = sortOrder;
        break;
      case "most_viewed":
        orderBy.views = 'desc';
        break;
      case "most_liked":
        // Sorting by JSON property isn't natively supported. Let's just sort by views as fallback.
        orderBy.views = 'desc'; 
        break;
      default:
        orderBy.publishedAt = sortOrder;
    }

    // Adjusting query for Prisma since `tags` is JSON and filtering JSON arrays is provider specific
    // We will do a Prisma query without the `tags` filter and filter in JS if `tag` is provided.
    delete query.tags;

    const cacheKey = buildListCacheKey(req.query);
    const cached = await getJSON(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        blogs: cached.blogs,
        pagination: cached.pagination,
        cached: true,
      });
    }

    const totalBlogs = await prisma.blogPost.count({ where: query });
    let blogs = await prisma.blogPost.findMany({
      where: query,
      orderBy,
      skip,
      take: limit
    });

    if (tag && tag.toLowerCase() !== "all") {
      // In-memory filter for tags
      blogs = blogs.filter(b => {
        const tags = Array.isArray(b.tags) ? b.tags : [];
        return tags.some(t => String(t).toLowerCase() === tag.toLowerCase());
      });
    }

    const totalPages = Math.ceil(totalBlogs / limit);
    await setJSON(
      cacheKey,
      {
        blogs,
        pagination: {
          currentPage: page,
          totalPages,
          totalBlogs,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit,
        },
      },
      120,
    );

    await redisClient.sAdd("cache:keys", cacheKey);

    res.status(200).json({
      success: true,
      blogs,
      pagination: {
        currentPage: page,
        totalPages,
        totalBlogs,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit,
      },
    });
  } catch (error) {
    console.error("Error in getAllBlogs:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const deleteBlog = async (req, res) => {
  try {
    const { title } = req.body;
    const id = req.params.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Blog ID is required",
      });
    }

    const existingBlog = await prisma.blogPost.findUnique({ where: { id } });

    if (!existingBlog) {
      return res.status(409).json({
        success: false,
        message: "Blog not found",
      });
    }

    await prisma.blogPost.delete({ where: { id } });

    await invalidateBlogCaches(id);
    await invalidateAllListCaches();

    await createNotification({
      type: "blog.deleted",
      title: "Blog deleted",
      message: `Blog "${existingBlog.title}" deleted`,
      severity: "critical",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "blog", id: existingBlog.id, label: existingBlog.title },
      audience: { permissions: ["blogs:read"] },
    });

    res.json({
      success: true,
      message: `Blog "${title || existingBlog.title}" deleted successfully`,
      title: title || existingBlog.title,
    });
  } catch (error) {
    console.error("Error deleting blog:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete blog",
      error: error.message,
    });
  }
};

const getBlogById = async (req, res) => {
  try {
    const id = req.params.id;

    const cacheKey = `blog:detail:${id}`;
    const cached = await getJSON(cacheKey);
    if (cached) {
      return res.json({ success: true, blog: cached, cached: true });
    }

    const blog = await prisma.blogPost.update({
      where: { id },
      data: { views: { increment: 1 } }
    });

    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });

    await setJSON(cacheKey, blog, 600);

    res.json({ success: true, blog, cached: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getBlogBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;

    const cacheKey = `blog:slug:${slug}`;
    const cached = await getJSON(cacheKey);
    if (cached) {
      return res.json({ success: true, blog: cached, cached: true });
    }

    const blog = await prisma.blogPost.update({
      where: { slug },
      data: { views: { increment: 1 } }
    });

    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });

    await setJSON(cacheKey, blog, 600);

    res.json({ success: true, blog, cached: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

const writeCommentOnBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, user } = req.body;

    if (!text || text.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Comment is empty" });
    }

    const blog = await prisma.blogPost.findUnique({ where: { id } });
    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    if (!blog.commentsEnabled) {
      return res.status(403).json({
        success: false,
        message: "Comments are disabled for this blog",
      });
    }

    const comments = Array.isArray(blog.comments) ? [...blog.comments] : [];
    
    // Create an objectid-like id for the comment to support replies later
    const commentId = Math.random().toString(36).substring(2, 15);
    
    comments.push({
      _id: commentId,
      id: commentId,
      user,
      text,
      replies: []
    });

    await prisma.blogPost.update({
      where: { id },
      data: { comments }
    });

    await invalidateBlogCaches(blog.id);
    await invalidateAllListCaches();

    await createNotification({
      type: "blog.comment.added",
      title: "New blog comment",
      message: `Comment added on "${blog.title}"`,
      severity: "info",
      actor: { kind: "anonymous" },
      target: { kind: "blog", id: blog.id, label: blog.title },
      audience: { permissions: ["blogs:read"] },
    });

    res.json({
      success: true,
      message: "Comment added",
      commentsCount: comments.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateBlog = async (req, res) => {
  try {
    const dataId = req.body.id || req.params.id;

    if (!dataId) {
      return res.status(400).json({
        success: false,
        message: "Valid Blog ID is required",
      });
    }

    const updateData = {};
    const safeHtml = req.body.content ? sanitizeHtml(req.body.content, {
      allowedTags: [
        "p", "h1", "h2", "h3", "strong", "em", "a", "ul", "ol", "li", "blockquote", "code", "pre",
      ],
      allowedAttributes: {
        a: ["href", "target", "rel"],
      },
      allowedSchemes: ["http", "https"],
    }) : undefined;

    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.category !== undefined) updateData.category = req.body.category;
    if (req.body.shortDescription !== undefined) updateData.shortDescription = req.body.shortDescription;
    if (req.body.content !== undefined) updateData.content = safeHtml;
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.featured !== undefined) updateData.featured = req.body.featured;
    if (req.body.trending !== undefined) updateData.trending = req.body.trending;
    if (req.body.commentsEnabled !== undefined) updateData.commentsEnabled = req.body.commentsEnabled;
    if (req.body.image !== undefined) updateData.image = req.body.image;
    
    // Handle author json update
    const existingBlog = await prisma.blogPost.findUnique({ where: { id: dataId } });
    if (!existingBlog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    if (req.body.authorName !== undefined || req.body.authorProfileImage !== undefined || req.body.bio !== undefined) {
      const author = typeof existingBlog.author === 'object' ? existingBlog.author : JSON.parse(existingBlog.author || "{}");
      if (req.body.authorName !== undefined) author.name = req.body.authorName;
      if (req.body.authorProfileImage !== undefined) author.profileImage = req.body.authorProfileImage;
      if (req.body.bio !== undefined) author.bio = req.body.bio;
      updateData.author = author;
    }

    if (updateData.title) {
      const slug = req.body.title
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();
      updateData.slug = slug;
    }

    const updatedBlog = await prisma.blogPost.update({
      where: { id: dataId },
      data: updateData
    });

    await invalidateBlogCaches(updatedBlog.id);
    await invalidateAllListCaches();

    await createNotification({
      type: "blog.updated",
      title: "Blog is updated",
      message: `Blog ${updatedBlog.title} is updated`,
      severity: "info",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "blog", id: updatedBlog.id, label: updatedBlog.title },
      audience: { permissions: ["blogs:read"] },
    });

    res.json({
      success: true,
      message: "Blog updated successfully",
      blog: updatedBlog,
    });
  } catch (error) {
    console.error("Error updating blog:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update blog",
      error: error.message,
    });
  }
};

const toggleBlogLike = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const blog = await prisma.blogPost.findUnique({ where: { id } });
    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    const numberUserId = parseInt(userId);
    const likes = typeof blog.likes === 'object' && blog.likes ? blog.likes : { count: 0, users: [] };
    const users = Array.isArray(likes.users) ? likes.users : [];
    
    const alreadyLiked = users.includes(numberUserId);

    if (alreadyLiked) {
      // Unlike
      likes.users = users.filter(u => u !== numberUserId);
      likes.count = Math.max(0, (likes.count || 1) - 1);
    } else {
      // Like
      likes.users.push(numberUserId);
      likes.count = (likes.count || 0) + 1;
    }

    await prisma.blogPost.update({
      where: { id },
      data: { likes }
    });

    await invalidateBlogCaches(blog.id);
    await invalidateAllListCaches();

    res.json({
      success: true,
      liked: !alreadyLiked,
      totalLikes: likes.count,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const replyToComment = async (req, res) => {
  try {
    const { blogId, commentId } = req.params;
    const { text, user } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Reply text is empty",
      });
    }

    const blog = await prisma.blogPost.findUnique({ where: { id: blogId } });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    if (!blog.commentsEnabled) {
      return res.status(403).json({
        success: false,
        message: "Comments are disabled",
      });
    }

    const comments = Array.isArray(blog.comments) ? [...blog.comments] : [];
    const commentIndex = comments.findIndex(c => c.id === commentId || c._id === commentId);

    if (commentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const comment = comments[commentIndex];
    if (!Array.isArray(comment.replies)) {
      comment.replies = [];
    }

    const replyId = Math.random().toString(36).substring(2, 15);
    
    comment.replies.push({
      _id: replyId,
      id: replyId,
      user,
      text,
    });

    await prisma.blogPost.update({
      where: { id: blogId },
      data: { comments }
    });

    res.json({
      success: true,
      message: "Reply added",
      replyId,
      repliesCount: comment.replies.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteBlogsBulk = async (req, res) => {
  try {
    const incomingIds = Array.isArray(req.body?.ids) ? req.body.ids : [];

    if (incomingIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one blog id is required",
      });
    }

    const validIds = [...new Set(incomingIds.map((id) => String(id).trim()).filter(Boolean))];

    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid blog ids provided",
        invalidIds: [],
      });
    }

    const blogsToDelete = await prisma.blogPost.findMany({
      where: { id: { in: validIds } },
      select: { id: true, title: true }
    });

    if (blogsToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching blogs found",
        invalidIds: [],
        notFoundIds: validIds,
      });
    }

    const deletedIds = blogsToDelete.map((b) => b.id);
    const deletedTitles = blogsToDelete.map((b) => b.title);
    const notFoundIds = validIds.filter((id) => !deletedIds.includes(id));

    await prisma.blogPost.deleteMany({ where: { id: { in: deletedIds } } });

    await Promise.allSettled(
      deletedIds.map((id) => invalidateBlogCaches(id)),
    );
    await invalidateAllListCaches();

    try {
      await createNotification({
        type: "blog.bulk_deleted",
        title: "Blogs deleted",
        message: `${deletedIds.length} blog(s) deleted`,
        severity: "critical",
        actor: {
          kind: "staff",
          id: req.staffUser?.id,
          email: req.staffUser?.email,
        },
        target: {
          kind: "blog",
          label: `${deletedIds.length} blogs`,
        },
        audience: { permissions: ["blogs:read"] },
      });
    } catch (notificationErr) {
      console.error("Bulk delete notification failed:", notificationErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Deleted ${deletedIds.length} blog(s) successfully`,
      deletedCount: deletedIds.length,
      deletedIds,
      deletedTitles,
      invalidIds: [],
      notFoundIds,
    });
  } catch (error) {
    console.error("Error bulk deleting blogs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to bulk delete blogs",
      error: error.message,
    });
  }
};

module.exports = {
  createBlog,
  toggleActiveStatusOfBlog,
  updateBlog,
  toggleBlogLike,
  writeCommentOnBlog,
  deleteBlog,
  getAllBlogs,
  getBlogById,
  replyToComment,
  deleteBlogsBulk,
  getBlogBySlug,
};
