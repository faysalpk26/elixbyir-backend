const prisma = require("../utils/prismaClient");

const normalizeSelectedOptions = (selectedOptions = {}) => {
  if (!selectedOptions || typeof selectedOptions !== "object") return {};

  return Object.entries(selectedOptions)
    .map(([key, value]) => [String(key).trim(), String(value ?? "").trim()])
    .filter(([key, value]) => key.length > 0 && value.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
};

const buildVariantHash = (productId, selectedOptions = {}) => {
  const normalized = normalizeSelectedOptions(selectedOptions);
  const signature = Object.entries(normalized)
    .map(([key, value]) => `${key}:${value.toLowerCase()}`)
    .join("|");

  return `${productId}::${signature || "default"}`;
};

const normalizeProductId = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeVariant = (productId, selectedOptions = {}) => {
  const normalizedOptions = normalizeSelectedOptions(selectedOptions);
  return {
    selectedOptions: normalizedOptions,
    variantHash: buildVariantHash(productId, normalizedOptions),
  };
};

const resolveItemVariantHash = (item) => {
  const productId = normalizeProductId(item?.productId);
  if (!productId) return "";

  const fromOptions = buildVariantHash(productId, item?.selectedOptions || {});
  if (!item?.variantHash) return fromOptions;

  return String(item.variantHash);
};

const isSameVariant = (item, productId, variantHash) => {
  return (
    normalizeProductId(item?.productId) === normalizeProductId(productId) &&
    resolveItemVariantHash(item) === variantHash
  );
};

const getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId, items: [] } });
    }

    const items = Array.isArray(cart.items) ? [...cart.items] : [];

    if (items.length === 0) {
      return res.json({
        success: true,
        cart: [],
        totalItems: 0,
        totalPrice: 0,
      });
    }

    const productIds = [
      ...new Set(
        items
          .map((item) => normalizeProductId(item.productId))
          .filter((id) => id !== null),
      ),
    ];

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        available: true,
      }
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    const removedItems = [];
    const validItems = [];
    const cartItemsWithDetails = [];
    let cartMutated = false;

    for (const item of items) {
      const productId = normalizeProductId(item.productId);
      if (productId === null) {
        removedItems.push({ productId: item.productId, reason: "Invalid product id" });
        cartMutated = true;
        continue;
      }

      const product = productMap.get(productId);
      if (!product) {
        removedItems.push({ productId, reason: "Unavailable or deleted product" });
        cartMutated = true;
        continue;
      }

      const { selectedOptions, variantHash } = normalizeVariant(
        productId,
        item.selectedOptions || {},
      );

      const normalizedItem = {
        productId,
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || Number(product.new_price) || 0,
        selectedOptions,
        variantHash,
        addedAt: item.addedAt || new Date(),
      };

      validItems.push(normalizedItem);

      if (
        !item.variantHash ||
        resolveItemVariantHash(item) !== variantHash ||
        JSON.stringify(item.selectedOptions || {}) !== JSON.stringify(selectedOptions)
      ) {
        cartMutated = true;
      }

      cartItemsWithDetails.push({
        id: product.id,
        name: product.name,
        price: normalizedItem.price,
        quantity: normalizedItem.quantity,
        image: product.image,
        category: product.category,
        available: product.available,
        stock_quantity: product.stock_quantity,
        addedAt: normalizedItem.addedAt,
        selectedOptions,
        variantHash,
      });
    }

    if (cartMutated || validItems.length !== items.length) {
      await prisma.cart.update({
        where: { id: cart.id },
        data: { items: validItems }
      });
    }

    const totalItems = cartItemsWithDetails.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cartItemsWithDetails.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    return res.json({
      success: true,
      cart: cartItemsWithDetails,
      totalItems,
      totalPrice,
      removedItems: removedItems.length > 0 ? removedItems : undefined,
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      cart: [],
      totalItems: 0,
      totalPrice: 0,
    });
  }
};

const addToCart = async (req, res) => {
  try {
    const { userId, productId, quantity = 1, selectedOptions = {} } = req.body;

    const normalizedProductId = normalizeProductId(productId);
    const normalizedQuantity = Number(quantity);

    if (!userId || normalizedProductId === null) {
      return res.status(400).json({
        success: false,
        message: "User ID and valid Product ID are required",
      });
    }

    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    const product = await prisma.product.findUnique({ where: { id: normalizedProductId } });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    if (!product.available) {
      return res.status(400).json({ success: false, message: "Product is not available" });
    }

    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId, items: [] } });
    }

    const items = Array.isArray(cart.items) ? [...cart.items] : [];

    const { selectedOptions: normalizedOptions, variantHash } = normalizeVariant(
      normalizedProductId,
      selectedOptions,
    );

    const existingItemIndex = items.findIndex((item) =>
      isSameVariant(item, normalizedProductId, variantHash),
    );

    if (existingItemIndex > -1) {
      const newQuantity = items[existingItemIndex].quantity + normalizedQuantity;

      if (
        product.stock_quantity !== undefined &&
        product.stock_quantity !== null &&
        product.stock_quantity < newQuantity
      ) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock available. Only ${product.stock_quantity} items left.`,
        });
      }

      items[existingItemIndex].quantity = newQuantity;
      items[existingItemIndex].selectedOptions = normalizedOptions;
      items[existingItemIndex].variantHash = variantHash;
      items[existingItemIndex].price = Number(product.new_price);
    } else {
      if (
        product.stock_quantity !== undefined &&
        product.stock_quantity !== null &&
        product.stock_quantity < normalizedQuantity
      ) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock available. Only ${product.stock_quantity} items left.`,
        });
      }

      items.push({
        productId: normalizedProductId,
        quantity: normalizedQuantity,
        price: Number(product.new_price),
        selectedOptions: normalizedOptions,
        variantHash,
        addedAt: new Date(),
      });
    }

    const updatedCart = await prisma.cart.update({
      where: { id: cart.id },
      data: { items }
    });

    return res.json({
      success: true,
      message: "Item added to cart successfully",
      cart: updatedCart,
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to add item to cart",
    });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const { userId, productId, quantity, variantHash, selectedOptions } = req.body;

    const normalizedProductId = normalizeProductId(productId);
    const normalizedQuantity = Number(quantity);

    if (!userId || normalizedProductId === null || !Number.isFinite(normalizedQuantity)) {
      return res.status(400).json({
        success: false,
        message: "Invalid parameters",
      });
    }

    if (normalizedQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity cannot be negative",
      });
    }

    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const items = Array.isArray(cart.items) ? [...cart.items] : [];

    let effectiveVariantHash = variantHash || "";
    if (!effectiveVariantHash && selectedOptions) {
      effectiveVariantHash = buildVariantHash(normalizedProductId, selectedOptions);
    }

    const itemIndex = items.findIndex((item) => {
      if (effectiveVariantHash) {
        return isSameVariant(item, normalizedProductId, String(effectiveVariantHash));
      }
      return normalizeProductId(item.productId) === normalizedProductId;
    });

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    if (normalizedQuantity === 0) {
      items.splice(itemIndex, 1);
    } else {
      const product = await prisma.product.findUnique({ where: { id: normalizedProductId } });
      if (
        product &&
        product.stock_quantity !== undefined &&
        product.stock_quantity !== null &&
        product.stock_quantity < normalizedQuantity
      ) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock available. Only ${product.stock_quantity} items left.`,
        });
      }

      items[itemIndex].quantity = normalizedQuantity;
    }

    const updatedCart = await prisma.cart.update({
      where: { id: cart.id },
      data: { items }
    });

    return res.json({
      success: true,
      message: "Cart updated successfully",
      cart: updatedCart,
    });
  } catch (error) {
    console.error("Error updating cart:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to update cart",
    });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { userId, productId, variantHash } = req.body;

    const normalizedProductId = normalizeProductId(productId);

    if (!userId || normalizedProductId === null) {
      return res.status(400).json({
        success: false,
        message: "User ID and valid Product ID are required",
      });
    }

    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    let items = Array.isArray(cart.items) ? cart.items : [];
    const initialLength = items.length;

    if (variantHash) {
      items = items.filter(
        (item) => !isSameVariant(item, normalizedProductId, String(variantHash)),
      );
    } else {
      items = items.filter(
        (item) => normalizeProductId(item.productId) !== normalizedProductId,
      );
    }

    if (items.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    const updatedCart = await prisma.cart.update({
      where: { id: cart.id },
      data: { items }
    });

    return res.json({
      success: true,
      message: "Item removed from cart successfully",
      cart: updatedCart,
    });
  } catch (error) {
    console.error("Error removing from cart:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to remove item from cart",
    });
  }
};

const clearCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return res.json({ success: true, message: "Cart was already empty" });
    }

    const items = Array.isArray(cart.items) ? cart.items : [];
    const itemCount = items.length;
    
    await prisma.cart.update({
      where: { id: cart.id },
      data: { items: [] }
    });

    return res.json({
      success: true,
      message: "Cart cleared successfully",
      clearedItems: itemCount,
    });
  } catch (error) {
    console.error("Error clearing cart:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to clear cart",
    });
  }
};

const syncCart = async (req, res) => {
  try {
    const { userId, localCartItems } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId, items: [] } });
    }

    const items = Array.isArray(cart.items) ? [...cart.items] : [];

    const syncResults = {
      syncedItems: [],
      failedItems: [],
      mergedItems: [],
    };

    if (Array.isArray(localCartItems) && localCartItems.length > 0) {
      for (const localItem of localCartItems) {
        try {
          const normalizedProductId = normalizeProductId(localItem.id);
          const normalizedQuantity = Number(localItem.quantity);

          if (
            normalizedProductId === null ||
            !Number.isFinite(normalizedQuantity) ||
            normalizedQuantity <= 0
          ) {
            syncResults.failedItems.push({
              item: localItem,
              reason: "Invalid item data",
            });
            continue;
          }

          const product = await prisma.product.findUnique({
            where: { id: normalizedProductId }
          });

          if (!product || !product.available) {
            syncResults.failedItems.push({
              item: localItem,
              reason: "Product no longer available",
            });
            continue;
          }

          const { selectedOptions, variantHash } = normalizeVariant(
            normalizedProductId,
            localItem.selectedOptions || {},
          );

          let finalQuantity = normalizedQuantity;
          if (
            product.stock_quantity !== undefined &&
            product.stock_quantity !== null &&
            product.stock_quantity < normalizedQuantity
          ) {
            if (product.stock_quantity > 0) {
              finalQuantity = product.stock_quantity;
            } else {
              syncResults.failedItems.push({
                item: localItem,
                reason: "Out of stock",
              });
              continue;
            }
          }

          const existingItemIndex = items.findIndex((item) =>
            isSameVariant(item, normalizedProductId, variantHash),
          );

          if (existingItemIndex > -1) {
            const existingQuantity = items[existingItemIndex].quantity;
            const totalQuantity = existingQuantity + finalQuantity;

            if (
              product.stock_quantity !== undefined &&
              product.stock_quantity !== null &&
              totalQuantity > product.stock_quantity
            ) {
              items[existingItemIndex].quantity = product.stock_quantity;
            } else {
              items[existingItemIndex].quantity = totalQuantity;
            }

            items[existingItemIndex].price = Number(product.new_price);
            items[existingItemIndex].selectedOptions = selectedOptions;
            items[existingItemIndex].variantHash = variantHash;

            syncResults.mergedItems.push({
              productId: normalizedProductId,
              productName: product.name,
              variantHash,
            });
          } else {
            items.push({
              productId: normalizedProductId,
              quantity: finalQuantity,
              price: Number(product.new_price),
              selectedOptions,
              variantHash,
              addedAt: new Date(),
            });

            syncResults.syncedItems.push({
              productId: normalizedProductId,
              productName: product.name,
              quantity: finalQuantity,
              variantHash,
            });
          }
        } catch (itemError) {
          syncResults.failedItems.push({
            item: localItem,
            reason: itemError.message || "Processing error",
          });
        }
      }
    }

    await prisma.cart.update({
      where: { id: cart.id },
      data: { items }
    });

    return res.json({
      success: true,
      message: "Session cart synced successfully",
      syncResults: {
        totalCartItems: items.length,
        newItemsSynced: syncResults.syncedItems.length,
        itemsMerged: syncResults.mergedItems.length,
        failedItems: syncResults.failedItems.length,
        details: syncResults,
      },
    });
  } catch (error) {
    console.error("Error syncing session cart:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to sync session cart",
    });
  }
};

const getCartSummary = async (req, res) => {
  try {
    const { userId } = req.params;

    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      return res.json({
        success: true,
        totalItems: 0,
        totalPrice: 0,
      });
    }
    
    const items = Array.isArray(cart.items) ? cart.items : [];
    if (items.length === 0) {
      return res.json({
        success: true,
        totalItems: 0,
        totalPrice: 0,
      });
    }

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    return res.json({
      success: true,
      totalItems,
      totalPrice,
    });
  } catch (error) {
    console.error("Error getting cart summary:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      totalItems: 0,
      totalPrice: 0,
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  syncCart,
  getCartSummary,
};
