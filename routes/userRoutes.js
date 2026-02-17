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
    userLogout
} from "../controllers/userController.js";
import { googleAuthCallback } from "../controllers/authController.js";

import { preventCache, checkUserSession} from "../middlewares/authMiddleware.js";

const router = express.Router();

//----------------------------------------------------------
// Index/Home page
router.get("/", preventCache, homePage);

//----------------------------------------------------------
// Signup page
router.get("/signup", preventCache, signupPage);
router.post("/send-signup-otp", sendSignupOtpController);
router.post("/verify-signup-otp", verifySignupOtp);
router.post("/resend-signup-otp", resendSignupOtp);

//----------------------------------------------------------
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

//----------------------------------------------------------
//user account
router.get('/account', checkUserSession, preventCache, userAccount);

//----------------------------------------------------------
//user address
router.get('/address',checkUserSession, preventCache,addressPage );
//Add a new address
router.post('/address/add', checkUserSession, addAddress);
//Edit an existing address
router.put('/address/edit/:addressId', checkUserSession, editAddress);
//Delete an address
router.delete('/address/delete/:addressId', checkUserSession, adressDelete);
//Set address as default
router.patch('/address/set-default/:addressId', checkUserSession, setAsDefault);

//----------------------------------------------------------
// Logout Route
router.get('/logout', userLogout);

export default router;