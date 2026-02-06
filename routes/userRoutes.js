import express from "express";
import passport from "passport";
import {
    homePage,
    signupPage,
    sendSignupOtpController,
    verifySignupOtp,
    loginPage,
    loginSubmit,
    forgotPasswordPage, 
    forgotPasswordSubmit, 
    resetPasswordPage, 
    resetPasswordSubmit
} from "../controllers/userController.js";
import { googleAuthCallback } from "../controllers/authController.js";

import { preventCache } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Index/Home page
router.get("/", preventCache, homePage);

// Signup page
router.get("/signup", preventCache, signupPage);
router.post("/send-signup-otp", sendSignupOtpController);
router.post("/verify-signup-otp", verifySignupOtp);

// Login page
router.get("/login", preventCache, loginPage);
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

// Forgot Password
router.get("/forgot-password", preventCache, forgotPasswordPage);
router.post("/forgot-password", forgotPasswordSubmit);

// Reset Password
router.get("/reset-password/:token", preventCache, resetPasswordPage);
router.post("/reset-password/:token", resetPasswordSubmit);
export default router;