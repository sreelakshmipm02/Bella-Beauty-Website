import express from "express";
import {
    adminLoginPage,
    adminLogin,
    dashboardPage,
    adminForgotPasswordPage,
    adminForgotPasswordSubmit,
    adminResetPasswordPage,
    adminResetPasswordSubmit
} from "../controllers/adminController.js";

import { 
    checkAdminSession,
    preventCache } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Get Login Page
router.get('/login', preventCache, adminLoginPage);

// Post Login Data
router.post('/login', adminLogin);

// Dashboard (Protected + No Cache)
router.get('/dashboard', checkAdminSession, preventCache, dashboardPage);

// Forgot Password
router.get("/forgot-password", adminForgotPasswordPage);
router.post("/forgot-password", adminForgotPasswordSubmit);

// Reset Password
router.get("/reset-password/:token", adminResetPasswordPage);
router.post("/reset-password/:token", adminResetPasswordSubmit);

export default router;