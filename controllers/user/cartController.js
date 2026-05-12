import {
  addItemToCart,
  getCartData,
  updateItemQuantity,
  removeCartItem,
  validateCartAvailability,
  applyCouponToCart,
  removeCouponFromCart,
} from "../../services/userServices/cartService.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";

// ---------------------------------------------------------
//  1. CART ACTIONS (Add, Update, Remove)
// ---------------------------------------------------------

/**
 * Add a product to the cart.
 * If quantity is not given, it will default to 1.
 */
export const addToCart = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const { variantId, quantity } = req.body;
  const cart = await addItemToCart(userId, variantId, parseInt(quantity) || 1);

  res.status(200).json({
    success: true,
    message: "Item added to cart successfully!",
    cartCount: cart.items.length,
  });
});

/**
 * Update item quantity in cart using AJAX.
 * Returns updated cart data for UI changes.
 */
export const updateCartAjax = asyncHandler(async (req, res) => {
  const { variantId, quantity } = req.body;
  const newCartData = await updateItemQuantity(
    req.session.userId,
    variantId,
    parseInt(quantity),
  );
  res.status(200).json({ success: true, cart: newCartData });
});

/**
 * Remove an item from the cart using AJAX.
 */
export const removeFromCartAjax = asyncHandler(async (req, res) => {
  const { variantId } = req.body;
  const newCartData = await removeCartItem(req.session.userId, variantId);
  res.status(200).json({ success: true, cart: newCartData });
});

export const applyCouponAjax = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const cartData = await applyCouponToCart(req.session.userId, code);

  res.status(200).json({
    success: true,
    message: `Coupon ${cartData.appliedCoupon.code} applied successfully.`,
    cart: cartData,
  });
});

export const removeCouponAjax = asyncHandler(async (req, res) => {
  const cartData = await removeCouponFromCart(req.session.userId);

  res.status(200).json({
    success: true,
    message: "Coupon removed successfully.",
    cart: cartData,
  });
});

// ---------------------------------------------------------
//  2. CART PAGE
// ---------------------------------------------------------

/**
 * Show the cart page.
 * If there is a stock issue, display a warning message.
 */
export const getCartPage = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const cartData = await getCartData(userId);
  const errorMsg =
    req.query.error === "stock_issue"
      ? "Some items in your cart are out of stock. Please remove them to continue."
      : null;

  res.render("user/cart", {
    title: "Your Shopping Cart - Bella Beauty",
    isLoggedIn: true,
    cart: cartData,
    adjustments: cartData.adjustments || [],
    errorMsg,
  });
});

// ---------------------------------------------------------
//  3. CART TO WISHLIST (OPTIONAL)
// ---------------------------------------------------------

/**
 * Move item from cart to wishlist.
 * First add to wishlist, then remove from cart.
 */
// export const moveToWishlistAjax = async (req, res) => {
//     try {
//         const userId = req.session.userId;
//         const { variantId } = req.body;

//         await addToWishlistSafe(userId, variantId);
//         await removeCartItem(userId, variantId);

//         const updatedCart = await getCartData(userId);

//         res.json({ success: true, message: "Moved to Wishlist", cart: updatedCart });
//     } catch (error) {
//         console.error("Move to Wishlist Error:", error);
//         res.status(400).json({ success: false, message: error.message });
//     }
// };

// ---------------------------------------------------------
//  4. CHECKOUT VALIDATION
// ---------------------------------------------------------

/**
 * Check if all items are still available before checkout.
 */
export const verifyCheckoutAvailability = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  await validateCartAvailability(userId);
  await getCartData(userId);
  res.status(200).json({ success: true });
});
