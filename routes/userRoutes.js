import express from "express";
import passport from "passport";
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
    forgotPasswordLoggedIn
} from "../controllers/user/userController.js";
import { googleAuthCallback } from "../controllers/user/authController.js";
import { getHomePage } from "../controllers/user/homeController.js";
import { getShopPage, getProductDetails } from "../controllers/user/userProductController.js";
import { addToCart, getCartPage, updateCartAjax, removeFromCartAjax, moveToWishlistAjax } from "../controllers/user/cartController.js";
import { getWishlistPage, toggleWishlistAjax, moveToCartAjax } from "../controllers/user/wishlistController.js";
import { getCheckoutPage, placeOrderAjax } from "../controllers/user/checkoutController.js";
import { getOrderSuccessPage, getOrderHistoryPage, getOrderDetailPage, cancelOrderAjax, cancelItemAjax, returnOrderAjax, returnItemAjax, downloadInvoice } from "../controllers/user/orderController.js";

import { verifyCartStockBeforeCheckout } from "../middlewares/cartMiddleware.js";
import { preventCache, checkUserSession, checkUserSessionAjax, isGuest, injectCartCount } from "../middlewares/authMiddleware.js";
import { uploadUser } from "../middlewares/upload.js";

const router = express.Router();
router.use(injectCartCount);

// ==========================================
// Public Web Routes
// ==========================================
router.get("/", preventCache, getHomePage);
router.get("/shop", preventCache, getShopPage);
router.get("/product/:slug", preventCache, getProductDetails); 

// Signup & OTP
router.get("/signup", preventCache, isGuest, signupPage);
router.post("/signup/otp", sendSignupOtpController);         
router.post("/signup/otp/verify", verifySignupOtp);          
router.post("/signup/otp/resend", resendSignupOtp);          

// Login & Auth
router.get("/login", preventCache, isGuest, loginPage);
router.post("/login", loginSubmit);
router.get("/logout", userLogout);

// Google OAuth
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), googleAuthCallback);

// Public Password Reset
router.get("/forgot-password", preventCache, forgotPasswordPage);
router.post("/forgot-password", forgotPasswordSubmit);
router.get("/reset-password/:token", preventCache, resetPasswordPage);
router.post("/reset-password/:token", resetPasswordSubmit);

// ==========================================
// Protected Account & Profile Routes
// ==========================================
router.get('/account', preventCache, checkUserSession, userAccount);
router.put('/profile', checkUserSession, uploadUser.single('profileImage'), updateProfile);

// Email update flow
router.post('/email/otp', checkUserSession, sendUpdateEmailOtp);
router.put('/email', checkUserSession, verifyEmailUpdate);

// ==========================================
// RESTful Address Management Routes
// ==========================================
router.get('/address', preventCache, checkUserSession, addressPage);
router.post('/address', checkUserSession, addAddress);
router.get('/address/:addressId', checkUserSession, getSingleAddress);
router.put('/address/:addressId', checkUserSession, editAddress);
router.delete('/address/:addressId', checkUserSession, adressDelete);
router.patch('/address/:addressId/default', checkUserSession, setAsDefault);

// ==========================================
// Protected Password Management
// ==========================================
router.get('/password', preventCache, checkUserSession, passwordPage);
router.put('/password', checkUserSession, updatePassword);
router.post('/password/forgot', checkUserSession, forgotPasswordLoggedIn);

// ---------------week3------------------------

// Cart Views
router.get('/cart', checkUserSession, preventCache, getCartPage);

// Cart AJAX Actions (RESTful)
router.post('/cart/items', checkUserSessionAjax, addToCart);
router.patch('/cart/items', checkUserSessionAjax, updateCartAjax);
router.delete('/cart/items', checkUserSessionAjax, removeFromCartAjax);
router.post('/cart/items/move-to-wishlist', checkUserSessionAjax, moveToWishlistAjax);

// Wishlist Routes (RESTful)
router.get('/wishlist', checkUserSession, preventCache, getWishlistPage);
router.post('/wishlist/items/toggle', checkUserSessionAjax, toggleWishlistAjax);
router.post('/wishlist/items/move-to-cart', checkUserSessionAjax, moveToCartAjax);

// CHECKOUT ROUTES
router.get('/checkout', checkUserSession, verifyCartStockBeforeCheckout, preventCache, getCheckoutPage);
router.post('/orders', checkUserSessionAjax, placeOrderAjax); // Place order

// Order Success Route (RESTful Sub-resource)
router.get('/orders/:orderId/success', checkUserSession, preventCache, getOrderSuccessPage);

// Order Routes
router.get('/orders', checkUserSession, preventCache, getOrderHistoryPage);
router.get('/orders/:orderId', checkUserSession, preventCache, getOrderDetailPage);

// Order Action Routes (RESTful Sub-resources)
router.post('/orders/:orderId/cancel', checkUserSessionAjax, cancelOrderAjax);
router.post('/orders/:orderId/items/:itemId/cancel', checkUserSessionAjax, cancelItemAjax);
router.post('/orders/:orderId/return', checkUserSessionAjax, returnOrderAjax);
router.post('/orders/:orderId/items/:itemId/return', checkUserSessionAjax, returnItemAjax);
router.get('/orders/:orderId/invoice', checkUserSession, downloadInvoice);

export default router;