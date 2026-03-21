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
import { addToCart, getCartPage, updateCartAjax, removeFromCartAjax } from "../controllers/user/cartController.js";
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
// preventCache now correctly fires before checkUserSession
router.get('/account', preventCache, checkUserSession, userAccount);

// RESTful: PUT /profile updates the user's profile resource
router.put('/profile', checkUserSession, uploadUser.single('profileImage'), updateProfile);

// Email update flow
router.post('/email/otp', checkUserSession, sendUpdateEmailOtp);
router.put('/email', checkUserSession, verifyEmailUpdate);

// ==========================================
// RESTful Address Management Routes
// ==========================================
// preventCache now correctly fires before checkUserSession
router.get('/address', preventCache, checkUserSession, addressPage);

// Create new address
router.post('/address', checkUserSession, addAddress);

// Get single address (AJAX)
router.get('/address/:addressId', checkUserSession, getSingleAddress);

// Update entire address
router.put('/address/:addressId', checkUserSession, editAddress);

// Delete address
router.delete('/address/:addressId', checkUserSession, adressDelete);

// Update specific address property (Set Default)
router.patch('/address/:addressId/default', checkUserSession, setAsDefault);

// ==========================================
// Protected Password Management
// ==========================================
// preventCache now correctly fires before checkUserSession
router.get('/password', preventCache, checkUserSession, passwordPage);

// Update password
router.put('/password', checkUserSession, updatePassword);

// Trigger password reset while logged in
router.post('/password/forgot', checkUserSession, forgotPasswordLoggedIn);

// ---------------week3------------------------
// Cart Views
router.get('/cart', checkUserSession, preventCache, getCartPage);

// Cart AJAX Actions (No Refresh)
router.post('/cart/add', checkUserSessionAjax, addToCart);
router.patch('/cart/update', checkUserSessionAjax, updateCartAjax);
router.delete('/cart/remove', checkUserSessionAjax, removeFromCartAjax);

export default router;