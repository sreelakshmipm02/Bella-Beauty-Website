import express from "express";
import {
    adminLoginPage,
    adminLogin,
    dashboardPage,
    adminForgotPasswordPage,
    adminForgotPasswordSubmit,
    adminResetPasswordPage,
    adminResetPasswordSubmit,
    userManagementPage,
    toggleUserStatus,
    adminLogout
} from "../controllers/admin/adminController.js";

import {
    categoryManagementPage,
    softDeleteCategory
} from "../controllers/admin/categoryController.js";

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

// User management
router.get('/user', checkAdminSession, preventCache, userManagementPage);
// Toggle User Status - Async update
router.patch('/user/toggle-status/:userId', checkAdminSession, toggleUserStatus);

// Forgot Password
router.get("/forgot-password", adminForgotPasswordPage);
router.post("/forgot-password", adminForgotPasswordSubmit);

// Reset Password
router.get("/reset-password/:token", adminResetPasswordPage);
router.post("/reset-password/:token", adminResetPasswordSubmit);


// Logout Route
router.get('/logout', adminLogout);

//-------------week1 completed-----------------------------------------------

// Category Listing
router.get('/category', checkAdminSession, preventCache, categoryManagementPage);

// Toggle Category Status (Soft Delete)
router.patch('/category/toggle-status/:categoryId', checkAdminSession, softDeleteCategory);

export default router;