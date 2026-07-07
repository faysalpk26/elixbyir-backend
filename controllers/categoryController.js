const prisma = require("../utils/prismaClient");
const { createNotification } = require("../utils/notificationService");

exports.getAllCategories = async (req, res) => {
  try {
    const { active, search, includeCounts, storefront } = req.query;
    const storefrontEnabled =
      storefront !== undefined &&
      ["1", "true", "yes"].includes(String(storefront).toLowerCase());

    const query = {};
    if (active !== undefined) query.isActive = active === "true";
    if (search) query.name = { contains: search };

    const categories = await prisma.category.findMany({
      where: query,
      orderBy: [{ order: "asc" }, { name: "asc" }]
    });

    if (includeCounts !== "true") {
      return res.json({ success: true, categories });
    }

    const productMatch = {};
    if (storefrontEnabled) {
      productMatch.available = true;
    }

    const productCounts = await prisma.product.groupBy({
      by: ['category'],
      _count: { _all: true },
      where: productMatch
    });

    const countMap = new Map();
    productCounts.forEach(row => {
      if (row.category) {
        const normalized = row.category.trim().toLowerCase();
        countMap.set(normalized, (countMap.get(normalized) || 0) + row._count._all);
      }
    });

    const categoriesWithCounts = categories.map((cat) => ({
      ...cat,
      productCount: countMap.get(String(cat.name || "").trim().toLowerCase()) || 0,
    }));

    return res.json({
      success: true,
      categories: categoriesWithCounts,
      countsByCategory: Object.fromEntries(countMap),
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};


exports.getCategoryById = async (req, res) => {
  try {
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      category,
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: error.message,
    });
  }
};

exports.createCategory = async (req, res) => {
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

    const existingCategory = await prisma.category.findFirst({
      where: { OR: [{ name }, { slug }] }
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    const lastCategory = await prisma.category.findFirst({
      orderBy: { order: "desc" }
    });
    const order = lastCategory ? lastCategory.order + 1 : 1;

    const category = await prisma.category.create({
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
      type: "category.created",
      title: "Category created",
      message: `Category "${category.name}" created`,
      severity: "high",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "category", id: category.id, label: category.name },
      audience: { permissions: ["categories:read"] },
    });

    res.json({
      success: true,
      message: "Category created successfully",
      category,
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

exports.updateCategory = async (req, res) => {
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

    const category = await prisma.category.findUnique({ where: { id: req.params.id } });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    let updateData = {};

    if (name && name !== category.name) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();

      const existingCategory = await prisma.category.findFirst({
        where: {
          id: { not: req.params.id },
          OR: [{ name }, { slug }]
        }
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists",
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

    const updatedCategory = await prisma.category.update({
      where: { id: category.id },
      data: updateData
    });

    await createNotification({
      type: "category.updated",
      title: "Category updated",
      message: `Category "${updatedCategory.name}" updated`,
      severity: "info",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "category", id: updatedCategory.id, label: updatedCategory.name },
      audience: { permissions: ["categories:read"] },
    });

    res.json({
      success: true,
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message,
    });
  }
};

exports.toggleCategoryActiveStatus = async (req, res) => {
  try {
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const updatedCategory = await prisma.category.update({
      where: { id: category.id },
      data: { isActive: !category.isActive }
    });

    await createNotification({
      type: "category.updated",
      title: "Category Active Status Change",
      message: `Category "${updatedCategory.name}" updated`,
      severity: "info",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "category", id: updatedCategory.id, label: updatedCategory.name },
      audience: { permissions: ["categories:read"] },
    });

    res.json({
      success: true,
      message: `Category ${updatedCategory.isActive ? "activated" : "deactivated"} successfully`,
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error toggling category status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle category status",
      error: error.message,
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const productCount = await prisma.product.count({
      where: { category: category.name }
    });

    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${productCount} products. Please reassign or delete products first.`,
      });
    }

    await prisma.category.delete({ where: { id: category.id } });

    await createNotification({
      type: "category.deleted",
      title: "Category deleted",
      message: `Category "${category.name}" deleted`,
      severity: "critical",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "category", id: category.id, label: category.name },
      audience: { permissions: ["categories:read"] },
    });

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message,
    });
  }
};

exports.reorderCategory = async (req, res) => {
  try {
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds)) {
      return res.status(400).json({
        success: false,
        message: "Category IDs must be an array",
      });
    }

    const updatePromises = categoryIds.map((id, index) =>
      prisma.category.update({ where: { id }, data: { order: index } })
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

exports.getCategoryStats = async (req, res) => {
  try {
    const totalCategories = await prisma.category.count();
    const activeCategories = await prisma.category.count({ where: { isActive: true } });
    const inactiveCategories = await prisma.category.count({ where: { isActive: false } });

    const categories = await prisma.category.findMany();

    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const productCount = await prisma.product.count({
          where: {
            category: category.name,
            available: true,
          }
        });
        return {
          ...category,
          productCount,
        };
      })
    );

    res.json({
      success: true,
      stats: {
        total: totalCategories,
        active: activeCategories,
        inactive: inactiveCategories,
      },
      categories: categoriesWithCounts,
    });
  } catch (error) {
    console.error("Error fetching category stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category statistics",
      error: error.message,
    });
  }
};

module.exports = exports;
