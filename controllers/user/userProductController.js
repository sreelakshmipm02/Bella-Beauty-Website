import {
  getShopData,
  getActiveCategories,
  getActiveBrands,
  getActiveProductTypes,
  getProductBySlug,
  getCategoryById,
  getActiveVariants,
  enrichVariantsWithOffers,
  getAttributesByIds,
  getRelatedProducts,
} from "../../services/userServices/productService.js";

import { getUserCartVariantIds } from "../../services/userServices/cartService.js";

import { getUserWishlistProductIds } from "../../services/userServices/wishlistService.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";

// Serves as the brain for the main "Shop All" page.
// This controller gathers the user's search terms, filters, and page numbers,
// then asks the service layer to crunch the numbers. It hands all that data back
// to the EJS template so the frontend can build the product grid and populate the filter sidebar.
export const getShopPage = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 9;
  const skip = (page - 1) * limit;
  const { products, totalProducts } = await getShopData(req.query, skip, limit);
  const categories = await getActiveCategories();
  const brands = await getActiveBrands();
  const productTypes = await getActiveProductTypes();
  const totalPages = Math.ceil(totalProducts / limit);

  //Fetch Wishlist IDs if the user is logged in
  let wishlistProductIds = [];
  if (req.session.userId) {
    wishlistProductIds = await getUserWishlistProductIds(req.session.userId);
  }

  res.render("user/shop", {
    title: "Shop - Bella Beauty",
    isLoggedIn: !!req.session.userId,
    products,
    categories,
    brands,
    productTypes,
    currentPage: page,
    totalPages,
    totalProducts,
    query: req.query,
    wishlistProductIds,
    wishlistProductIdsJSON: JSON.stringify(wishlistProductIds),
  });
});

// Constructs the Product Detail Page (PDP) when a customer clicks on a specific item.
// This function includes several strict safety checks to ensure a user can never
// view or buy a product that has been disabled, deleted, or stripped of its variants by an admin.
export const getProductDetails = asyncHandler(async (req, res) => {
  const slug = req.params.slug;
  const product = await getProductBySlug(slug);

  if (!product || product.status !== "active") {
    return res.redirect("/shop");
  }

  const category = await getCategoryById(product.categoryId);
  if (!category || category.status !== "active") {
    return res.redirect("/shop");
  }

  const rawVariants = await getActiveVariants(product._id);
  const variants = await enrichVariantsWithOffers(product, rawVariants);
  if (!variants || variants.length === 0) {
    return res.redirect("/shop");
  }

  let cartVariantIds = [];
  let wishlistProductIds = [];
  if (req.session.userId) {
    cartVariantIds = await getUserCartVariantIds(req.session.userId);
    wishlistProductIds = await getUserWishlistProductIds(req.session.userId);
  }

  const attributeIds = [
    ...new Set(variants.flatMap((v) => v.attributes.map((a) => a.attributeId))),
  ];
  const attributesInfo = await getAttributesByIds(attributeIds);
  const relatedProducts = await getRelatedProducts(
    category._id,
    product._id,
    4,
  );

  res.render("user/productDetail", {
    title: `${product.name} - Bella Beauty`,
    isLoggedIn: !!req.session.userId,
    product,
    category,
    variants,
    attributesInfo,
    variantsJSON: JSON.stringify(variants),
    cartVariantIdsJSON: JSON.stringify(cartVariantIds),
    wishlistProductIdsJSON: JSON.stringify(wishlistProductIds),
    relatedProducts,
  });
});
