import Wishlist from "../../models/wishlist.js";
import ProductVariant from "../../models/productVariant.js";
import AppError from "../../utils/AppError.js";

const loadWishlistWithProducts = async (userId) => {
  return await Wishlist.findOne({ userId }).populate({
    path: "items.productVariantId",
    populate: { path: "productId" },
  });
};

const getProductIdFromVariant = (variant) => {
  const productId = variant?.productId?._id || variant?.productId;
  return productId ? productId.toString() : null;
};

const getVariantId = (variant) => {
  const variantId = variant?._id || variant;
  return variantId ? variantId.toString() : null;
};

const findActiveVariantForProduct = async (productId, inStockOnly = false) => {
  const query = {
    productId,
    status: "active",
  };

  if (inStockOnly) {
    query.stock = { $gt: 0 };
  }

  return await ProductVariant.findOne(query).populate("productId");
};

const resolveRepresentativeVariant = async (storedVariant) => {
  const product = storedVariant?.productId;

  if (!product || product.status !== "active") {
    return null;
  }

  if (storedVariant.status === "active" && Number(storedVariant.stock) > 0) {
    return storedVariant;
  }

  const inStockVariant = await findActiveVariantForProduct(product._id, true);
  if (inStockVariant) {
    return inStockVariant;
  }

  if (storedVariant.status === "active") {
    return storedVariant;
  }

  return await findActiveVariantForProduct(product._id, false);
};

const normalizeWishlist = async (wishlist) => {
  if (!wishlist || !Array.isArray(wishlist.items) || wishlist.items.length === 0) {
    return { changed: false, itemMetadata: [] };
  }

  const normalizedItems = [];
  const itemMetadata = [];
  const seenProductIds = new Set();
  let changed = false;

  for (const item of wishlist.items) {
    const representativeVariant = await resolveRepresentativeVariant(item.productVariantId);
    const productId = getProductIdFromVariant(representativeVariant);

    if (!representativeVariant || !productId) {
      changed = true;
      continue;
    }

    if (seenProductIds.has(productId)) {
      changed = true;
      continue;
    }

    if (getVariantId(item.productVariantId) !== getVariantId(representativeVariant)) {
      item.productVariantId = representativeVariant._id;
      changed = true;
    }

    normalizedItems.push(item);
    itemMetadata.push({
      item,
      productId,
      product: representativeVariant.productId,
      representativeVariant,
    });
    seenProductIds.add(productId);
  }

  if (changed) {
    wishlist.items = normalizedItems;
  }

  return { changed, itemMetadata };
};

const findVariantOrThrow = async (variantId) => {
  const variant = await ProductVariant.findById(variantId).populate("productId");

  if (!variant?.productId || variant.productId.status !== "active") {
    throw new AppError("This product is currently unavailable.", 404);
  }

  return variant;
};

// -------------------------------
// 1. MAIN WISHLIST ACTIONS
// -------------------------------

// This stores one representative variant per product.
export const toggleWishlistItem = async (userId, variantId) => {
  const targetVariant = await findVariantOrThrow(variantId);
  const targetProductId = getProductIdFromVariant(targetVariant);
  let wishlist = await loadWishlistWithProducts(userId);

  if (!wishlist) {
    wishlist = new Wishlist({ userId, items: [] });
  }

  const { changed, itemMetadata } = await normalizeWishlist(wishlist);
  const removableIds = new Set(
    itemMetadata
      .filter((entry) => entry.productId === targetProductId)
      .map((entry) => entry.item._id.toString()),
  );

  let isAdded = false;

  if (removableIds.size > 0) {
    wishlist.items = wishlist.items.filter(
      (item) => !removableIds.has(item._id.toString()),
    );
  } else {
    wishlist.items.push({ productVariantId: targetVariant._id });
    isAdded = true;
  }

  if (changed || removableIds.size > 0 || isAdded) {
    await wishlist.save();
  }

  return {
    isAdded,
    totalItems: wishlist.items.length,
    productId: targetProductId,
  };
};

// Remove item directly from wishlist
export const removeWishlistItem = async (userId, variantId) => {
  const targetVariant = await ProductVariant.findById(variantId).populate("productId");

  if (!targetVariant?.productId) {
    await Wishlist.updateOne(
      { userId },
      { $pull: { items: { productVariantId: variantId } } },
    );

    const fallbackWishlist = await Wishlist.findOne({ userId }).select("items");
    return {
      productId: null,
      totalItems: fallbackWishlist?.items?.length || 0,
    };
  }

  const wishlist = await loadWishlistWithProducts(userId);
  if (!wishlist) {
    return {
      productId: getProductIdFromVariant(targetVariant),
      totalItems: 0,
    };
  }

  const targetProductId = getProductIdFromVariant(targetVariant);
  const { changed, itemMetadata } = await normalizeWishlist(wishlist);
  const removableIds = new Set(
    itemMetadata
      .filter((entry) => entry.productId === targetProductId)
      .map((entry) => entry.item._id.toString()),
  );

  if (removableIds.size > 0) {
    wishlist.items = wishlist.items.filter(
      (item) => !removableIds.has(item._id.toString()),
    );
  }

  if (changed || removableIds.size > 0) {
    await wishlist.save();
  }

  return {
    productId: targetProductId,
    totalItems: wishlist.items.length,
  };
};

// Add item only if not already in wishlist
export const addToWishlistSafe = async (userId, variantId) => {
  const targetVariant = await findVariantOrThrow(variantId);
  const targetProductId = getProductIdFromVariant(targetVariant);
  let wishlist = await loadWishlistWithProducts(userId);

  if (!wishlist) {
    wishlist = new Wishlist({ userId, items: [] });
  }

  const { changed, itemMetadata } = await normalizeWishlist(wishlist);
  const alreadyInWishlist = itemMetadata.some(
    (entry) => entry.productId === targetProductId,
  );

  if (!alreadyInWishlist) {
    wishlist.items.push({ productVariantId: targetVariant._id });
    await wishlist.save();
    return true;
  }

  if (changed) {
    await wishlist.save();
  }

  return false;
};

// -------------------------------
// 2. GET WISHLIST DATA
// -------------------------------

// Get wishlist items with product details
export const getWishlistData = async (userId) => {
  const wishlist = await loadWishlistWithProducts(userId);

  if (!wishlist || wishlist.items.length === 0) return [];

  const { changed, itemMetadata } = await normalizeWishlist(wishlist);

  if (changed) {
    await wishlist.save();
  }

  const formattedItems = itemMetadata.map(
    ({ item, productId, product, representativeVariant }) => ({
      productId,
      variantId: representativeVariant._id,
      productName: product.name,
      brand: product.brand,
      slug: product.slug,
      image: representativeVariant.images[0],
      price: representativeVariant.price,
      stock: representativeVariant.stock,
      attributes: representativeVariant.attributes,
      addedAt: item.addedAt,
    }),
  );

  return formattedItems.reverse();
};

// -------------------------------
// 3. HELPER FOR UI
// -------------------------------

// Get product IDs so all variants of the same product share one wishlist state.
export const getUserWishlistProductIds = async (userId) => {
  if (!userId) return [];

  const wishlist = await loadWishlistWithProducts(userId);

  if (!wishlist) return [];

  const { changed, itemMetadata } = await normalizeWishlist(wishlist);

  if (changed) {
    await wishlist.save();
  }

  return itemMetadata.map((entry) => entry.productId);
};
