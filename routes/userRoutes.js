import express from "express";
import passport from "passport";
import {
    homePage,
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
} from "../controllers/userController.js";
import { googleAuthCallback } from "../controllers/authController.js";

import { preventCache, checkUserSession, isGuest } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";


const router = express.Router();

//----------------------------------------------------------
// Index/Home page
router.get("/", preventCache, homePage);

//----------------------------------------------------------
// Signup page
router.get("/signup", preventCache, isGuest, signupPage);
router.post("/send-signup-otp", sendSignupOtpController);
router.post("/verify-signup-otp", verifySignupOtp);
router.post("/resend-signup-otp", resendSignupOtp);

//----------------------------------------------------------
// Login page
router.get("/login", preventCache, isGuest, loginPage);
router.post("/login", loginSubmit);

// Google login
router.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google callback
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  googleAuthCallback
);

//----------------------------------------------------------
//user account
router.get('/account', checkUserSession, preventCache, userAccount);
// 1. Update Profile (Text + Image)
router.put('/user/update-profile', checkUserSession, upload.single('profileImage'), updateProfile);

// 2. Send OTP for Email Change
router.post('/user/update-email-otp', checkUserSession, sendUpdateEmailOtp);

// 3. Verify OTP and Finalize Email Change
router.post('/user/verify-email-update', checkUserSession, verifyEmailUpdate);

//----------------------------------------------------------
//user address
router.get('/address',checkUserSession, preventCache,addressPage );
//Add a new address
router.post('/address/add', checkUserSession, addAddress);
//fetch single address
router.get('/address/:addressId', checkUserSession, getSingleAddress);
//Edit an existing address
router.put('/address/edit/:addressId', checkUserSession, editAddress);
//Delete an address
router.delete('/address/delete/:addressId', checkUserSession, adressDelete);
//Set address as default
router.patch('/address/set-default/:addressId', checkUserSession, setAsDefault);

//----------------------------------------------------------
// user password management
router.get('/password', checkUserSession, preventCache, passwordPage);
router.put('/password/update', checkUserSession, updatePassword);
router.post('/password/forgot-loggedin', checkUserSession, forgotPasswordLoggedIn); 

//----------------------------------------------------------
// Logout Route
router.get('/logout', userLogout);

//----------------------------------------------------------
// Forgot Password
router.get("/forgot-password", preventCache, forgotPasswordPage);
router.post("/forgot-password", forgotPasswordSubmit);

// Reset Password
router.get("/reset-password/:token", preventCache, resetPasswordPage);
router.post("/reset-password/:token", resetPasswordSubmit);

export default router;