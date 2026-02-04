import express from "express";
import {
    homePage,
    signupPage,
    sendSignupOtpController,
    verifySignupOtp,
    loginPage
    
} from "../controllers/userController.js";

const router = express.Router();

//index page
router.get("/",homePage);

//signup page
router.get("/signup",signupPage);
router.post("/send-signup-otp",sendSignupOtpController);
router.post("/verify-signup-otp",verifySignupOtp);

//login page
router.get("/login",loginPage);
// router.post("/login",loginsubmit);

export default router;