import Wishlist from "../../models/wishlist.js";

// -------------------------------
// 1. MAIN WISHLIST ACTIONS
// -------------------------------

// This function handles add/remove using one button (like a heart icon)
export const toggleWishlistItem = async (userId, variantId) => {
  // Find user's wishlist
  let wishlist = await Wishlist.findOne({ userId });

  // Create wishlist if not exists
  if (!wishlist) {
    wishlist = new Wishlist({ userId, items: [] });
  }

  // Check if item already exists
  const itemIndex = wishlist.items.findIndex(
    (item) => item.productVariantId.toString() === variantId.toString(),
  );

  let isAdded = false;

  if (itemIndex > -1) {
    // If found → remove item
    wishlist.items.splice(itemIndex, 1);
  } else {
    // If not found → add item
    wishlist.items.push({ productVariantId: variantId });
    isAdded = true;
  }

  await wishlist.save();

  return { isAdded, totalItems: wishlist.items.length };
};

// Remove item directly from wishlist
export const removeWishlistItem = async (userId, variantId) => {
  await Wishlist.updateOne(
    { userId },
    { $pull: { items: { productVariantId: variantId } } },
  );
};

// Add item only if not already in wishlist
export const addToWishlistSafe = async (userId, variantId) => {
  let wishlist = await Wishlist.findOne({ userId });

  // Create if not exists
  if (!wishlist) {
    wishlist = new Wishlist({ userId, items: [] });
  }

  // Check duplicate
  const alreadyInWishlist = wishlist.items.some(
    (item) => item.productVariantId.toString() === variantId.toString(),
  );

  if (!alreadyInWishlist) {
    wishlist.items.push({ productVariantId: variantId });
    await wishlist.save();
    return true;
  }

  return false; // Already exists
};

// -------------------------------
// 2. GET WISHLIST DATA
// -------------------------------

// Get wishlist items with product details
export const getWishlistData = async (userId) => {
  const wishlist = await Wishlist.findOne({ userId }).populate({
    path: "items.productVariantId",
    populate: { path: "productId" },
  });

  // If empty
  if (!wishlist || wishlist.items.length === 0) return [];

  let formattedItems = [];
  let wishlistModified = false;

  // Loop through items
  for (let item of wishlist.items) {
    const variant = item.productVariantId;
    const product = variant?.productId;

    // Only include active products
    if (
      variant &&
      variant.status === "active" &&
      product &&
      product.status === "active"
    ) {
      formattedItems.push({
        variantId: variant._id,
        productName: product.name,
        brand: product.brand,
        slug: product.slug,
        image: variant.images[0],
        price: variant.price,
        stock: variant.stock,
        attributes: variant.attributes,
        addedAt: item.addedAt,
      });
    } else {
      // Remove invalid items automatically
      wishlist.items = wishlist.items.filter(
        (i) => i._id.toString() !== item._id.toString(),
      );
      wishlistModified = true;
    }
  }

  // Save if any items were removed
  if (wishlistModified) await wishlist.save();

  // Show latest items first
  return formattedItems.reverse();
};

// -------------------------------
// 3. HELPER FOR UI
// -------------------------------

// Get all variant IDs for frontend (to show filled heart icon)
export const getUserWishlistVariantIds = async (userId) => {
  if (!userId) return [];

  const wishlist = await Wishlist.findOne({ userId });

  if (!wishlist) return [];

  return wishlist.items.map((item) => item.productVariantId.toString());
};
