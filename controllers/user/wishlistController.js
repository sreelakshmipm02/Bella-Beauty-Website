import {
  toggleWishlistItem,
  getWishlistData,
  removeWishlistItem,
} from "../../services/userServices/wishlistService.js";
import { addItemToCart } from "../../services/userServices/cartService.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";

// ---------------------------------------------------------
//  1. WISHLIST PAGE
// ---------------------------------------------------------

/**
 * Show user's wishlist items.
 */
export const getWishlistPage = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const wishlistItems = await getWishlistData(userId);

  res.render("user/wishlist", {
    title: "My Wishlist - Bella Beauty",
    isLoggedIn: true,
    wishlistItems,
  });
});

// ---------------------------------------------------------
//  2. WISHLIST ACTIONS (AJAX)
// ---------------------------------------------------------

/**
 * Add or remove item from wishlist (toggle).
 */
export const toggleWishlistAjax = asyncHandler(async (req, res) => {
  const { variantId } = req.body;
  const result = await toggleWishlistItem(req.session.userId, variantId);
  res.status(200).json({
    success: true,
    isAdded: result.isAdded,
    productId: result.productId,
    wishlistCount: result.totalItems,
  });
});

/**
 * Move item from wishlist to cart.
 */
export const moveToCartAjax = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const { variantId } = req.body;
  const cart = await addItemToCart(userId, variantId, 1);
  const result = await removeWishlistItem(userId, variantId);

  res.status(200).json({
    success: true,
    message: "Item moved to cart successfully!",
    cartCount: cart.items.length,
    productId: result.productId,
    wishlistCount: result.totalItems,
  });
});
