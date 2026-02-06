import express from "express";
import passport from "passport";
import {
    homePage,
    signupPage,
    sendSignupOtpController,
    verifySignupOtp,
    loginPage,
    loginSubmit,
    userAccount,
    userLogout
} from "../controllers/userController.js";
import { googleAuthCallback } from "../controllers/authController.js";

import { preventCache, checkUserSession} from "../middlewares/authMiddleware.js";

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

//user account
router.get('/account', checkUserSession, preventCache, userAccount);

// Logout Route
router.get('/logout', userLogout);

export default router;