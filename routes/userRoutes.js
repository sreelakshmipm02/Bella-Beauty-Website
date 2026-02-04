import express from "express";
import passport from "passport";
import {
    homePage,
    signupPage,
    sendSignupOtpController,
    verifySignupOtp,
    loginPage,
    loginSubmit
    
} from "../controllers/userController.js";
import { googleAuthCallback } from "../controllers/authController.js";

const router = express.Router();

//index page
router.get("/",homePage);

//signup page
router.get("/signup",signupPage);
router.post("/send-signup-otp",sendSignupOtpController);
router.post("/verify-signup-otp",verifySignupOtp);

//login page
router.get("/login",loginPage);
router.post("/login",loginSubmit);

//google login
router.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

//google callback
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  googleAuthCallback
);

export default router;