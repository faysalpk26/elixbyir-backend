const prisma = require("../utils/prismaClient");
const { createNotification } = require("../utils/notificationService");

const getAllBlogCategories = async (req, res) => {
  try {
    const { active, search } = req.query;

    let query = {};

    if (active !== undefined) {
      query.isActive = active === "true";
    }

    if (search) {
      query.name = { contains: search };
    }

    const blogCategories = await prisma.blogCategory.findMany({
      where: query
    });

    res.json({
      success: true,
      blogCategories,
    });
  } catch (error) {
    console.error("Error fetching blogCategories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blogCategories",
      error: error.message,
    });
  }
};

const getBlogCategoryById = async (req, res) => {
  try {
    const blogCategory = await prisma.blogCategory.findUnique({
      where: { id: req.params.id }
    });

    if (!blogCategory) {
      return res.status(404).json({
        success: false,
        message: "Blog Category not found",
      });
    }

    res.json({
      success: true,
      blogCategory,
    });
  } catch (error) {
    console.error("Error fetching blog category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blog category",
      error: error.message,
    });
  }
};

const createBlogCategory = async (req, res) => {
  try {
    const {
      name,
      description,
      image,
      icon,
      isActive,
      parentCategory,
      metaTitle,
      metaDescription,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    const existingCategory = await prisma.blogCategory.findFirst({
      where: { OR: [{ name }, { slug }] }
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    const lastCategory = await prisma.blogCategory.findFirst({
      orderBy: { order: "desc" }
    });
    const order = lastCategory ? lastCategory.order + 1 : 1;

    const blogCategory = await prisma.blogCategory.create({
      data: {
        name,
        slug,
        description: description || "",
        image: image || "",
        icon: icon || "",
        isActive: isActive !== undefined ? isActive : true,
        parentCategory: parentCategory || null,
        metaTitle: metaTitle || name,
        metaDescription: metaDescription || description || "",
        order,
      }
    });

    await createNotification({
      type: "blogCategory.created",
      title: "Blog category created",
      message: `Blog category "${blogCategory.name}" created`,
      severity: "high",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: {
        kind: "blogCategory",
        id: blogCategory.id,
        label: blogCategory.name,
      },
      audience: { permissions: ["blogCategories:read"] },
    });

    res.json({
      success: true,
      message: "Blog Category created successfully",
      blogCategory,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message,
    });
  }
};

const updateBlogCategory = async (req, res) => {
  try {
    const {
      name,
      description,
      image,
      icon,
      isActive,
      parentCategory,
      metaTitle,
      metaDescription,
      order,
    } = req.body;

    const blogCategory = await prisma.blogCategory.findUnique({
      where: { id: req.params.id }
    });

    if (!blogCategory) {
      return res.status(404).json({
        success: false,
        message: "Blog Category not found",
      });
    }

    let updateData = {};

    if (name && name !== blogCategory.name) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();

      const existingCategory = await prisma.blogCategory.findFirst({
        where: {
          id: { not: req.params.id },
          OR: [{ name }, { slug }]
        }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Blog Category with this name already exists",
        });
      }

      updateData.name = name;
      updateData.slug = slug;
    }

    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (icon !== undefined) updateData.icon = icon;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (parentCategory !== undefined) updateData.parentCategory = parentCategory;
    if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
    if (order !== undefined) updateData.order = order;

    const updatedBlogCategory = await prisma.blogCategory.update({
      where: { id: blogCategory.id },
      data: updateData
    });

    await createNotification({
      type: "blogCategory.updated",
      title: "Blog category updated",
      message: `Blog category "${updatedBlogCategory.name}" updated`,
      severity: "info",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: {
        kind: "blogCategory",
        id: updatedBlogCategory.id,
        label: updatedBlogCategory.name,
      },
      audience: { permissions: ["blogCategories:read"] },
    });

    res.json({
      success: true,
      message: "Blog Category updated successfully",
      blogCategory: updatedBlogCategory,
    });
  } catch (error) {
    console.error("Error updating blog category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update blog category",
      error: error.message,
    });
  }
};

const toggleActiveStatusOfBlogCategory = async (req, res) => {
  try {
    const blogCategory = await prisma.blogCategory.findUnique({
      where: { id: req.params.id }
    });

    if (!blogCategory) {
      return res.status(404).json({
        success: false,
        message: "Blog Category not found",
      });
    }

    const updatedBlogCategory = await prisma.blogCategory.update({
      where: { id: blogCategory.id },
      data: { isActive: !blogCategory.isActive }
    });

    await createNotification({
      type: "blogCategory.updated",
      title: "Blog category Status Changed.",
      message: `Blog category "${updatedBlogCategory.name}" updated`,
      severity: "info",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: {
        kind: "blogCategory",
        id: updatedBlogCategory.id,
        label: updatedBlogCategory.name,
      },
      audience: { permissions: ["blogCategories:read"] },
    });

    res.json({
      success: true,
      message: `Blog Category ${updatedBlogCategory.isActive ? "activated" : "deactivated"} successfully`,
      blogCategory: updatedBlogCategory,
    });
  } catch (error) {
    console.error("Error toggling blog category status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle blog category status",
      error: error.message,
    });
  }
};

const deleteBlogCategory = async (req, res) => {
  try {
    const blogCategory = await prisma.blogCategory.findUnique({
      where: { id: req.params.id }
    });

    if (!blogCategory) {
      return res.status(404).json({
        success: false,
        message: "Blog Category not found",
      });
    }

    await prisma.blogCategory.delete({
      where: { id: req.params.id }
    });

    await createNotification({
      type: "blogCategory.deleted",
      title: "Blog category deleted",
      message: `Blog category "${blogCategory.name}" deleted`,
      severity: "critical",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: {
        kind: "blogCategory",
        id: blogCategory.id,
        label: blogCategory.name,
      },
      audience: { permissions: ["blogCategories:read"] },
    });

    res.json({
      success: true,
      message: "Blog Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting blog category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete blog category",
      error: error.message,
    });
  }
};

const reorderBlogCategory = async (req, res) => {
  try {
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds)) {
      return res.status(400).json({
        success: false,
        message: "Category IDs must be an array",
      });
    }

    const updatePromises = categoryIds.map((id, index) =>
      prisma.blogCategory.update({
        where: { id },
        data: { order: index }
      })
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: "Categories reordered successfully",
    });
  } catch (error) {
    console.error("Error reordering categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reorder categories",
      error: error.message,
    });
  }
};

const getBlogCategoryStats = async (req, res) => {
  try {
    const totalCategories = await prisma.blogCategory.count();
    const activeCategories = await prisma.blogCategory.count({
      where: { isActive: true },
    });
    const inactiveCategories = await prisma.blogCategory.count({
      where: { isActive: false },
    });

    res.json({
      success: true,
      stats: {
        total: totalCategories,
        active: activeCategories,
        inactive: inactiveCategories,
      },
    });
  } catch (error) {
    console.error("Error fetching blog category stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch blog category statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getAllBlogCategories,
  getBlogCategoryById,
  createBlogCategory,
  updateBlogCategory,
  toggleActiveStatusOfBlogCategory,
  getBlogCategoryStats,
  deleteBlogCategory,
  reorderBlogCategory,
};
