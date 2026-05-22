import express from "express";
import passport from "passport";

// Controller imports
import {
  signupPage,
  sendSignupOtpController,
  verifySignupOtp,
  resendSignupOtp,
  loginPage,
  loginSubmit,
  userAccount,
  addressPage,
  addAddress,
  editAddress,
  adressDelete,
  setAsDefault,
  updateProfile,
  sendUpdateEmailOtp,
  verifyEmailUpdate,
  userLogout,
  forgotPasswordPage,
  forgotPasswordSubmit,
  resetPasswordPage,
  resetPasswordSubmit,
  getSingleAddress,
  passwordPage,
  updatePassword,
  forgotPasswordLoggedIn,
  walletPage,
  signupInvitePage,
  verifyReferralAjax,
} from "../controllers/user/userController.js";
import { googleAuthCallback } from "../controllers/user/authController.js";
import { getHomePage } from "../controllers/user/homeController.js";
import {
  getShopPage,
  getProductDetails,
} from "../controllers/user/userProductController.js";
import {
  addToCart,
  getCartPage,
  updateCartAjax,
  removeFromCartAjax,
  verifyCheckoutAvailability,
  applyCouponAjax,
  removeCouponAjax,
} from "../controllers/user/cartController.js";
import {
  getWishlistPage,
  toggleWishlistAjax,
  moveToCartAjax,
} from "../controllers/user/wishlistController.js";
import {
  getCheckoutPage,
  placeOrderAjax,
  verifyOnlinePayment,
} from "../controllers/user/checkoutController.js";
import {
  getOrderSuccessPage,
  getPaymentFailurePage,
  getOrderHistoryPage,
  getOrderDetailPage,
  cancelOrderAjax,
  cancelItemAjax,
  returnOrderAjax,
  returnItemAjax,
  downloadInvoice,
  retryPaymentAjax,
} from "../controllers/user/orderController.js";

// Middleware imports
import { verifyCartStockBeforeCheckout } from "../middlewares/cartMiddleware.js";
import {
  preventCache,
  checkUserSession,
  checkUserSessionAjax,
  isGuest,
  injectCartCount,
  injectWishlistCount,
} from "../middlewares/authMiddleware.js";
import { uploadUser } from "../middlewares/upload.js";

const router = express.Router();

// Always inject the current cart and wishlist count so the navbar badge stays updated
router.use(injectCartCount);
router.use(injectWishlistCount);

// ---------------------------------------------------------
//  1. PUBLIC VISITOR ROUTES
// ---------------------------------------------------------
router.get("/", preventCache, getHomePage);
router.get("/shop", preventCache, getShopPage);
router.get("/product/:slug", preventCache, getProductDetails);

// --- Registration & OTP Flow ---
router.get("/signup", preventCache, isGuest, signupPage);
router.get(
  "/signup/invite/:inviteToken",
  preventCache,
  isGuest,
  signupInvitePage,
);
router.post("/signup/otp", sendSignupOtpController);
router.post("/signup/otp/verify", verifySignupOtp);
router.post("/signup/otp/resend", resendSignupOtp);
router.post("/referrals/verify", verifyReferralAjax);

// --- Login & Social Auth ---
router.get("/login", preventCache, isGuest, loginPage);
router.post("/login", loginSubmit);
router.get("/logout", userLogout);

// Google Sign-In logic
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
router.get("/auth/google/callback", googleAuthCallback);

// --- Public Password Recovery ---
router.get("/forgot-password", preventCache, forgotPasswordPage);
router.post("/forgot-password", forgotPasswordSubmit);
router.get("/reset-password/:token", preventCache, resetPasswordPage);
router.post("/reset-password/:token", resetPasswordSubmit);

// ---------------------------------------------------------
//  2. PROFILE & PERSONAL SETTINGS (Requires Login)
// ---------------------------------------------------------
router.get("/account", preventCache, checkUserSession, userAccount);
router.get("/wallet", preventCache, checkUserSession, walletPage);
router.put(
  "/profile",
  checkUserSession,
  uploadUser.single("profileImage"),
  updateProfile,
);

// Handles verification when a user wants to change their primary email
router.post("/email/otp", checkUserSession, sendUpdateEmailOtp);
router.put("/email", checkUserSession, verifyEmailUpdate);

// --- Address Book ---
router.get("/address", preventCache, checkUserSession, addressPage);
router.post("/address", checkUserSession, addAddress);
router.get("/address/:addressId", checkUserSession, getSingleAddress);
router.put("/address/:addressId", checkUserSession, editAddress);
router.delete("/address/:addressId", checkUserSession, adressDelete);
router.patch("/address/:addressId/default", checkUserSession, setAsDefault);

// --- Security Settings ---
router.get("/password", preventCache, checkUserSession, passwordPage);
router.put("/password", checkUserSession, updatePassword);
router.post("/password/forgot", checkUserSession, forgotPasswordLoggedIn);

// ---------------------------------------------------------
//  3. THE SHOPPING EXPERIENCE (Cart & Wishlist)
// ---------------------------------------------------------
router.get("/cart", checkUserSession, preventCache, getCartPage);
router.post(
  "/cart/verify-checkout",
  checkUserSessionAjax,
  verifyCheckoutAvailability,
);

// AJAX updates for a smoother UI (no page refreshes)
router.post("/cart/items", checkUserSessionAjax, addToCart);
router.patch("/cart/items", checkUserSessionAjax, updateCartAjax);
router.delete("/cart/items", checkUserSessionAjax, removeFromCartAjax);
router.post("/cart/coupon", checkUserSessionAjax, applyCouponAjax);
router.delete("/cart/coupon", checkUserSessionAjax, removeCouponAjax);

// Wishlist management
router.get("/wishlist", checkUserSession, preventCache, getWishlistPage);
router.post("/wishlist/items/toggle", checkUserSessionAjax, toggleWishlistAjax);
router.post(
  "/wishlist/items/move-to-cart",
  checkUserSessionAjax,
  moveToCartAjax,
);

// ---------------------------------------------------------
//  4. CHECKOUT & ORDER MANAGEMENT
// ---------------------------------------------------------
// Make sure stock is still available before allowing the user to view checkout
router.get(
  "/checkout",
  checkUserSession,
  verifyCartStockBeforeCheckout,
  preventCache,
  getCheckoutPage,
);
router.post("/orders", checkUserSessionAjax, placeOrderAjax);
router.post(
  "/orders/verify-payment",
  checkUserSessionAjax,
  verifyOnlinePayment,
);
router.get(
  "/payments/failure",
  checkUserSession,
  preventCache,
  getPaymentFailurePage,
);

// Tracking and History
router.get(
  "/orders/:orderId/success",
  checkUserSession,
  preventCache,
  getOrderSuccessPage,
);
router.get("/orders", checkUserSession, preventCache, getOrderHistoryPage);
router.post(
  "/orders/:orderId/retry-payment",
  checkUserSessionAjax,
  retryPaymentAjax,
);
router.get(
  "/orders/:orderId",
  checkUserSession,
  preventCache,
  getOrderDetailPage,
);

// Cancellations, Returns, and Downloads
router.post("/orders/:orderId/cancel", checkUserSessionAjax, cancelOrderAjax);
router.post(
  "/orders/:orderId/items/:itemId/cancel",
  checkUserSessionAjax,
  cancelItemAjax,
);
router.post("/orders/:orderId/return", checkUserSessionAjax, returnOrderAjax);
router.post(
  "/orders/:orderId/items/:itemId/return",
  checkUserSessionAjax,
  returnItemAjax,
);
router.get("/orders/:orderId/invoice", checkUserSession, downloadInvoice);

export default router;
