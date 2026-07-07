const prisma = require("../utils/prismaClient");

// Get user's wishlist
const getUsersWishlist = async (req, res) => {
  try {
    const { userId } = req.params;

    let wishlist = await prisma.wishlist.findUnique({ where: { userId } });

    if (!wishlist) {
      // Create empty wishlist if none exists
      wishlist = await prisma.wishlist.create({
        data: { userId, items: [] }
      });
    }

    const items = Array.isArray(wishlist.items) ? [...wishlist.items] : [];

    // Get full product details for wishlist items
    const wishlistItemsWithDetails = [];
    const validItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: parseInt(item.productId) } });
      if (product && product.available) {
        validItems.push(item);
        wishlistItemsWithDetails.push({
          id: product.id,
          name: product.name,
          new_price: product.new_price,
          old_price: product.old_price,
          image: product.image,
          category: product.category,
          brand: product.brand,
          available: product.available,
          stock_quantity: product.stock_quantity,
          featured: product.featured,
          slug: product.slug,
          addedAt: item.addedAt,
          hasDiscount: product.old_price > product.new_price,
          discountPercentage:
            product.old_price > product.new_price
              ? Math.round(
                  ((product.old_price - product.new_price) /
                    product.old_price) *
                    100,
                )
              : 0,
        });
      }
    }

    // Save wishlist if items were removed
    if (validItems.length !== items.length) {
      await prisma.wishlist.update({
        where: { id: wishlist.id },
        data: { items: validItems }
      });
    }

    res.json({
      success: true,
      wishlist: wishlistItemsWithDetails,
      totalItems: wishlistItemsWithDetails.length,
    });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      wishlist: [],
      totalItems: 0,
    });
  }
};

// Add item to wishlist
const addItemToWishlist = async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Product ID are required",
      });
    }

    // Get product details
    const product = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.available) {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    // Find or create wishlist
    let wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId, items: [] }
      });
    }

    const items = Array.isArray(wishlist.items) ? [...wishlist.items] : [];

    // Check if item already exists in wishlist
    const existingItemIndex = items.findIndex(
      (item) => item.productId === parseInt(productId) || item.productId === productId,
    );

    if (existingItemIndex > -1) {
      return res.status(400).json({
        success: false,
        message: "Item is already in your wishlist",
        alreadyExists: true,
      });
    }

    // Add new item with product snapshot
    items.push({
      productId: parseInt(productId),
      addedAt: new Date(),
      productSnapshot: {
        name: product.name,
        price: product.new_price,
        image: product.image,
        category: product.category,
      },
    });

    await prisma.wishlist.update({
      where: { id: wishlist.id },
      data: { items }
    });

    res.json({
      success: true,
      message: "Item added to wishlist successfully",
      totalItems: items.length,
    });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to add item to wishlist",
    });
  }
};

// Remove item from wishlist
const removeItemFromWishlist = async (req, res) => {
  try {
    const { userId, productId } = req.body;

    if (!userId || !productId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Product ID are required",
      });
    }

    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    const items = Array.isArray(wishlist.items) ? wishlist.items : [];
    const initialLength = items.length;
    
    const newItems = items.filter(
      (item) => item.productId !== parseInt(productId) && item.productId !== productId,
    );

    if (newItems.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "Item not found in wishlist",
      });
    }

    await prisma.wishlist.update({
      where: { id: wishlist.id },
      data: { items: newItems }
    });

    res.json({
      success: true,
      message: "Item removed from wishlist successfully",
      totalItems: newItems.length,
    });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to remove item from wishlist",
    });
  }
};

// Clear entire wishlist
const clearEntireWishlist = async (req, res) => {
  try {
    const { userId } = req.params;

    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    await prisma.wishlist.update({
      where: { id: wishlist.id },
      data: { items: [] }
    });

    res.json({
      success: true,
      message: "Wishlist cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing wishlist:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to clear wishlist",
    });
  }
};

// Check if item is in wishlist
const checkIfItemIsInWishlist = async (req, res) => {
  try {
    const { userId, productId } = req.params;

    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });

    if (!wishlist) {
      return res.json({
        success: true,
        isInWishlist: false,
      });
    }

    const items = Array.isArray(wishlist.items) ? wishlist.items : [];
    const isInWishlist = items.some(
      (item) => item.productId === parseInt(productId) || item.productId === String(productId),
    );

    res.json({
      success: true,
      isInWishlist: isInWishlist,
    });
  } catch (error) {
    console.error("Error checking wishlist:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      isInWishlist: false,
    });
  }
};

// Get wishlist summary (for header badge)
const getWishlistSummary = async (req, res) => {
  try {
    const { userId } = req.params;

    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });

    if (!wishlist) {
      return res.json({
        success: true,
        totalItems: 0,
      });
    }

    const items = Array.isArray(wishlist.items) ? wishlist.items : [];

    res.json({
      success: true,
      totalItems: items.length,
    });
  } catch (error) {
    console.error("Error getting wishlist summary:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      totalItems: 0,
    });
  }
};

// Sync wishlist from localStorage to backend (for when user logs in)
const syncWishlist = async (req, res) => {
  try {
    const { userId, localWishlistItems } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find or create wishlist
    let wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({
        data: { userId, items: [] }
      });
    }

    const items = Array.isArray(wishlist.items) ? [...wishlist.items] : [];

    // Merge local wishlist items with server wishlist
    if (localWishlistItems && localWishlistItems.length > 0) {
      for (const localItemId of localWishlistItems) {
        const existingItemIndex = items.findIndex(
          (item) => item.productId === localItemId || item.productId === parseInt(localItemId),
        );

        if (existingItemIndex === -1) {
          // Get product details for snapshot
          const product = await prisma.product.findUnique({ where: { id: parseInt(localItemId) } });
          if (product && product.available) {
            items.push({
              productId: parseInt(localItemId),
              addedAt: new Date(),
              productSnapshot: {
                name: product.name,
                price: product.new_price,
                image: product.image,
                category: product.category,
              },
            });
          }
        }
      }
    }

    await prisma.wishlist.update({
      where: { id: wishlist.id },
      data: { items }
    });

    res.json({
      success: true,
      message: "Wishlist synced successfully",
      totalItems: items.length,
    });
  } catch (error) {
    console.error("Error syncing wishlist:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to sync wishlist",
    });
  }
};

// Move items from wishlist to cart
const moveItemsFromWishlistToCart = async (req, res) => {
  try {
    const { userId, productIds, quantity = 1 } = req.body;

    if (!userId || !productIds || !Array.isArray(productIds)) {
      return res.status(400).json({
        success: false,
        message: "User ID and Product IDs array are required",
      });
    }

    const wishlist = await prisma.wishlist.findUnique({ where: { userId } });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId, items: [] }
      });
    }

    let wishlistItems = Array.isArray(wishlist.items) ? [...wishlist.items] : [];
    let cartItems = Array.isArray(cart.items) ? [...cart.items] : [];

    const movedItems = [];
    const failedItems = [];

    for (const productId of productIds) {
      const parsedId = parseInt(productId);
      const product = await prisma.product.findUnique({ where: { id: parsedId } });

      if (!product || !product.available) {
        failedItems.push({ productId, reason: "Product not available" });
        continue;
      }

      // Check stock
      if (
        product.stock_quantity !== undefined &&
        product.stock_quantity !== null &&
        product.stock_quantity < quantity
      ) {
        failedItems.push({ productId, reason: "Not enough stock" });
        continue;
      }

      // Add to cart
      const existingCartItemIndex = cartItems.findIndex(
        (item) => item.productId === parsedId || item.productId === productId,
      );

      if (existingCartItemIndex > -1) {
        cartItems[existingCartItemIndex].quantity += quantity;
      } else {
        cartItems.push({
          productId: parsedId,
          quantity: quantity,
          price: product.new_price,
          addedAt: new Date(),
        });
      }

      // Remove from wishlist
      wishlistItems = wishlistItems.filter(
        (item) => item.productId !== parsedId && item.productId !== productId,
      );
      movedItems.push(productId);
    }

    // Save both cart and wishlist
    await Promise.all([
      prisma.cart.update({ where: { id: cart.id }, data: { items: cartItems } }),
      prisma.wishlist.update({ where: { id: wishlist.id }, data: { items: wishlistItems } })
    ]);

    res.json({
      success: true,
      message: `Successfully moved ${movedItems.length} items to cart`,
      movedItems: movedItems,
      failedItems: failedItems,
      cartTotalItems: cartItems.length,
      wishlistTotalItems: wishlistItems.length,
    });
  } catch (error) {
    console.error("Error moving items to cart:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to move items to cart",
    });
  }
};

// Get wishlist analytics for admin
const getWishlistAnalyticsForAdmin = async (req, res) => {
  try {
    const totalWishlists = await prisma.wishlist.count();
    
    // Fallback: doing this in memory since Prisma doesn't have MongoDB's unwind/aggregate directly for JSON arrays
    const allWishlists = await prisma.wishlist.findMany({ select: { items: true } });
    
    let activeWishlists = 0;
    const productCounts = {};

    allWishlists.forEach(w => {
      const items = Array.isArray(w.items) ? w.items : [];
      if (items.length > 0) activeWishlists++;
      
      items.forEach(item => {
        const id = parseInt(item.productId);
        if (id) {
          productCounts[id] = (productCounts[id] || 0) + 1;
        }
      });
    });

    const sortedProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
      
    const productIds = sortedProducts.map(p => parseInt(p[0]));
    
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    const wishlistAnalytics = sortedProducts.map((item) => {
      const productId = parseInt(item[0]);
      const count = item[1];
      const product = products.find((p) => p.id === productId);
      
      return {
        productId,
        productName: product?.name || "Unknown",
        category: product?.category || "Unknown",
        wishlistCount: count,
        currentPrice: product?.new_price || 0,
        image: product?.image || "",
      };
    });

    // Average items per wishlist
    const totalItemsCount = allWishlists.reduce((sum, w) => {
      const items = Array.isArray(w.items) ? w.items : [];
      return sum + items.length;
    }, 0);
    
    const avgItemsPerWishlist = totalWishlists > 0 ? totalItemsCount / totalWishlists : 0;

    res.json({
      success: true,
      analytics: {
        totalWishlists,
        activeWishlists,
        emptyWishlists: totalWishlists - activeWishlists,
        avgItemsPerWishlist: Math.round(avgItemsPerWishlist * 100) / 100,
        mostWishlisted: wishlistAnalytics,
      },
    });
  } catch (error) {
    console.error("Error fetching wishlist analytics:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getUsersWishlist,
  addItemToWishlist,
  removeItemFromWishlist,
  clearEntireWishlist,
  checkIfItemIsInWishlist,
  getWishlistSummary,
  syncWishlist,
  moveItemsFromWishlistToCart,
  getWishlistAnalyticsForAdmin,
};
