const prisma = require("../utils/prismaClient");
const { createNotification } = require("../utils/notificationService");

// Create promo code
exports.createPromoCode = async (req, res) => {
  try {
    const {
      code,
      title,
      description,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      usageLimit,
      usagePerUser,
      validFrom,
      validUntil,
      isActive,
      applicableCategories,
      excludedProducts,
      userRestrictions,
    } = req.body;

    if (!code || !title || !discountValue || !validFrom || !validUntil) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const existingCode = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: "Promo code already exists",
      });
    }

    if (discountType === "percentage" && discountValue > 100) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount cannot exceed 100%",
      });
    }

    const startDate = new Date(validFrom);
    const endDate = new Date(validUntil);

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        title,
        description: description || "",
        discountType: discountType || "percentage",
        discountValue,
        minPurchaseAmount: minPurchaseAmount || 0,
        maxDiscountAmount: maxDiscountAmount || null,
        usageLimit: usageLimit || null,
        usagePerUser: usagePerUser || 1,
        validFrom: startDate,
        validUntil: endDate,
        isActive: isActive !== undefined ? isActive : true,
        applicableCategories: applicableCategories || [],
        excludedProducts: excludedProducts || [],
        userRestrictions: userRestrictions || {
          newUsersOnly: false,
          specificUsers: [],
        },
        usedBy: [],
        createdBy: req.staffUser?.id || null
      }
    });

    await createNotification({
      type: "promo.created",
      title: "Promo code created",
      message: `Promo "${promoCode.code}" created`,
      severity: "high",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "promo", id: promoCode.id, label: promoCode.code },
      audience: { permissions: ["promoCodes:read"] },
    });

    res.json({
      success: true,
      message: "Promo code created successfully",
      promoCode,
    });
  } catch (error) {
    console.error("Error creating promo code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create promo code",
      error: error.message,
    });
  }
};

// Get all promo codes
exports.getAllPromoCodes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || "all";
    const search = req.query.search || "";
    
    let query = {};

    const now = new Date();

    if (status === "active") {
      query.isActive = true;
      query.validFrom = { lte: now };
      query.validUntil = { gte: now };
    } else if (status === "inactive") {
      query.isActive = false;
    } else if (status === "expired") {
      query.validUntil = { lt: now };
    }

    if (search) {
      query.OR = [
        { code: { contains: search } },
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const count = await prisma.promoCode.count({ where: query });
    const promoCodes = await prisma.promoCode.findMany({
      where: query,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    const enrichedPromoCodes = promoCodes.map((code) => {
      const isExpired = now > new Date(code.validUntil);
      const isValidNow = code.isActive && now >= new Date(code.validFrom) && now <= new Date(code.validUntil);
      const remainingUses = code.usageLimit ? code.usageLimit - code.usageCount : null;
      const usagePercentage = code.usageLimit ? ((code.usageCount / code.usageLimit) * 100).toFixed(1) : 0;
      
      return {
        ...code,
        isExpired,
        isValidNow,
        remainingUses,
        usagePercentage,
      };
    });

    res.json({
      success: true,
      promoCodes: enrichedPromoCodes,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    console.error("Error fetching promo codes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch promo codes",
      error: error.message,
    });
  }
};

// Get single promo code
exports.getPromoCode = async (req, res) => {
  try {
    const promoCode = await prisma.promoCode.findUnique({ where: { id: req.params.id } });

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: "Promo code not found",
      });
    }

    res.json({
      success: true,
      promoCode,
    });
  } catch (error) {
    console.error("Error fetching promo code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch promo code",
      error: error.message,
    });
  }
};

// Update promo code
exports.updatePromoCode = async (req, res) => {
  try {
    const updates = req.body;
    
    // Convert dates if present
    if (updates.validFrom) updates.validFrom = new Date(updates.validFrom);
    if (updates.validUntil) updates.validUntil = new Date(updates.validUntil);
    
    const existingPromoCode = await prisma.promoCode.findUnique({ where: { id: req.params.id } });
    if (!existingPromoCode) {
      return res.status(404).json({
        success: false,
        message: "Promo code not found",
      });
    }

    const promoCode = await prisma.promoCode.update({
      where: { id: req.params.id },
      data: updates
    });

    await createNotification({
      type: "promo.updated",
      title: "Promo code updated",
      message: `Promo "${promoCode.code}" updated`,
      severity: "info",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "promo", id: promoCode.id, label: promoCode.code },
      audience: { permissions: ["promoCodes:read"] },
    });

    res.json({
      success: true,
      message: "Promo code updated successfully",
      promoCode,
    });
  } catch (error) {
    console.error("Error updating promo code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update promo code",
      error: error.message,
    });
  }
};

// Delete promo code
exports.deletePromoCode = async (req, res) => {
  try {
    const promoCode = await prisma.promoCode.findUnique({ where: { id: req.params.id } });

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: "Promo code not found",
      });
    }
    
    await prisma.promoCode.delete({ where: { id: req.params.id } });

    await createNotification({
      type: "promo.deleted",
      title: "Promo code deleted",
      message: `Promo "${promoCode.code}" deleted`,
      severity: "critical",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "promo", id: promoCode.id, label: promoCode.code },
      audience: { permissions: ["promoCodes:read"] },
    });

    res.json({
      success: true,
      message: "Promo code deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting promo code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete promo code",
      error: error.message,
    });
  }
};

// Toggle promo code status
exports.togglePromoCodeStatus = async (req, res) => {
  try {
    const existingPromoCode = await prisma.promoCode.findUnique({ where: { id: req.params.id } });

    if (!existingPromoCode) {
      return res.status(404).json({
        success: false,
        message: "Promo code not found",
      });
    }

    const promoCode = await prisma.promoCode.update({
      where: { id: req.params.id },
      data: { isActive: !existingPromoCode.isActive }
    });

    await createNotification({
      type: "promo.updated",
      title: "Promo code Status Changed.",
      message: `Promo "${promoCode.code}" updated`,
      severity: "info",
      actor: {
        kind: "staff",
        id: req.staffUser?.id,
        email: req.staffUser?.email,
      },
      target: { kind: "promo", id: promoCode.id, label: promoCode.code },
      audience: { permissions: ["promoCodes:read"] },
    });

    res.json({
      success: true,
      message: `Promo code ${promoCode.isActive ? "activated" : "deactivated"} successfully`,
      promoCode,
    });
  } catch (error) {
    console.error("Error toggling promo code status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle promo code status",
      error: error.message,
    });
  }
};

// Validate promo code
exports.validatePromoCode = async (req, res) => {
  try {
    const { code, userId, cartTotal } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Promo code is required",
      });
    }

    const promoCode = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: "Invalid promo code",
      });
    }

    const now = new Date();

    if (!promoCode.isActive) {
      return res.status(400).json({
        success: false,
        message: "This promo code is currently inactive",
      });
    }

    if (now < promoCode.validFrom) {
      return res.status(400).json({
        success: false,
        message: `This promo code will be valid from ${promoCode.validFrom.toLocaleDateString()}`,
      });
    }

    if (now > promoCode.validUntil) {
      return res.status(400).json({
        success: false,
        message: "This promo code has expired",
      });
    }

    if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
      return res.status(400).json({
        success: false,
        message: "This promo code has reached its usage limit",
      });
    }

    if (cartTotal < promoCode.minPurchaseAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase amount of $${promoCode.minPurchaseAmount} required`,
      });
    }

    if (userId && promoCode.usagePerUser) {
      const usedBy = Array.isArray(promoCode.usedBy) ? promoCode.usedBy : [];
      const userUsageCount = usedBy.filter(
        (usage) => usage.userId === userId,
      ).length;

      if (userUsageCount >= promoCode.usagePerUser) {
        return res.status(400).json({
          success: false,
          message: "You have already used this promo code the maximum number of times",
        });
      }
    }

    let discountAmount = 0;

    if (promoCode.discountType === "percentage") {
      discountAmount = (cartTotal * promoCode.discountValue) / 100;
    } else {
      discountAmount = promoCode.discountValue;
    }

    if (
      promoCode.maxDiscountAmount &&
      discountAmount > promoCode.maxDiscountAmount
    ) {
      discountAmount = promoCode.maxDiscountAmount;
    }

    if (discountAmount > cartTotal) {
      discountAmount = cartTotal;
    }

    const finalAmount = cartTotal - discountAmount;

    res.json({
      success: true,
      message: "Promo code applied successfully",
      promoCode: {
        code: promoCode.code,
        title: promoCode.title,
        description: promoCode.description,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
      },
      discount: {
        amount: discountAmount,
        type: promoCode.discountType,
        value: promoCode.discountValue,
      },
      originalAmount: cartTotal,
      finalAmount: finalAmount,
      savings: discountAmount,
    });
  } catch (error) {
    console.error("Error validating promo code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate promo code",
      error: error.message,
    });
  }
};

// Apply promo code to order
exports.applyPromoCode = async (req, res) => {
  try {
    const { code } = req.params;
    const { userId, orderAmount } = req.body;

    const promoCode = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: "Promo code not found",
      });
    }

    const usedBy = Array.isArray(promoCode.usedBy) ? [...promoCode.usedBy] : [];
    
    if (userId) {
      usedBy.push({
        userId,
        usedAt: new Date(),
        orderAmount,
      });
    }

    await prisma.promoCode.update({
      where: { id: promoCode.id },
      data: {
        usageCount: promoCode.usageCount + 1,
        usedBy: usedBy
      }
    });

    res.json({
      success: true,
      message: "Promo code applied to order",
    });
  } catch (error) {
    console.error("Error applying promo code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply promo code",
      error: error.message,
    });
  }
};

// Get promo code statistics
exports.getPromoCodeStats = async (req, res) => {
  try {
    const now = new Date();

    const [totalCodes, activeCodes, expiredCodes] =
      await Promise.all([
        prisma.promoCode.count(),
        prisma.promoCode.count({
          where: {
            isActive: true,
            validFrom: { lte: now },
            validUntil: { gte: now },
          }
        }),
        prisma.promoCode.count({
          where: {
            validUntil: { lt: now },
          }
        })
      ]);
      
    const totalUsageRaw = await prisma.promoCode.aggregate({
      _sum: { usageCount: true }
    });
    
    const topCodes = await prisma.promoCode.findMany({
      orderBy: { usageCount: 'desc' },
      take: 5,
      select: {
        code: true,
        title: true,
        usageCount: true,
        discountType: true,
        discountValue: true
      }
    });

    res.json({
      success: true,
      stats: {
        total: totalCodes,
        active: activeCodes,
        expired: expiredCodes,
        totalUsage: totalUsageRaw._sum.usageCount || 0,
        topPerformingCodes: topCodes,
      },
    });
  } catch (error) {
    console.error("Error fetching promo code stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};

// Get active promo codes
exports.getActivePromoCodes = async (req, res) => {
  try {
    const now = new Date();

    const activeCodes = await prisma.promoCode.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      select: {
        code: true,
        title: true,
        description: true,
        discountType: true,
        discountValue: true,
        minPurchaseAmount: true,
        validUntil: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      promoCodes: activeCodes,
    });
  } catch (error) {
    console.error("Error fetching active promo codes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active promo codes",
      error: error.message,
    });
  }
};

exports.deletePromoCodeBulk = async (req, res) => {
  try {
    const incomingIds = Array.isArray(req.body?.ids) ? req.body.ids : [];

    if (incomingIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one promocode id is required",
      });
    }

    const validIds = [...new Set(incomingIds.map((id) => String(id).trim()).filter(Boolean))];

    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid promoCode ids provided",
        invalidIds: [],
      });
    }

    const promoCodesToDelete = await prisma.promoCode.findMany({
      where: { id: { in: validIds } },
      select: { id: true }
    });

    if (promoCodesToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching promoCodes found",
        invalidIds: [],
        notFoundIds: validIds,
      });
    }

    const deletedIds = promoCodesToDelete.map((b) => String(b.id));
    const notFoundIds = validIds.filter((id) => !deletedIds.includes(id));

    await prisma.promoCode.deleteMany({ where: { id: { in: deletedIds } } });

    try {
      await createNotification({
        type: "promoCode.bulk_deleted",
        title: "PromoCode deleted",
        message: `${deletedIds.length} PromoCode(s) deleted`,
        severity: "critical",
        actor: {
          kind: "staff",
          id: req.staffUser?.id,
          email: req.staffUser?.email,
        },
        target: {
          kind: "promoCode",
          label: `${deletedIds.length} promoCode`,
        },
        audience: { permissions: ["promoCodes:read"] },
      });
    } catch (notificationErr) {
      console.error("PromoCode delete notification failed:", notificationErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Deleted ${deletedIds.length} PromoCode(s) successfully`,
      deletedCount: deletedIds.length,
      deletedIds,
      invalidIds: [],
      notFoundIds,
    });
  } catch (error) {
    console.error("Error bulk deleting promoCode:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to bulk delete promoCodes",
      error: error.message,
    });
  }
};

module.exports = exports;
