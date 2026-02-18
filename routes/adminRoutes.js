import express from "express";
import {
    adminLoginPage,
    adminLogin,
    dashboardPage,
    userManagementPage,
    toggleUserStatus,
    adminLogout
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

// User management
router.get('/user', checkAdminSession, preventCache, userManagementPage);
// Toggle User Status - Async update
router.patch('/user/toggle-status/:userId', checkAdminSession, toggleUserStatus);

// Logout Route
router.get('/logout', adminLogout);

export default router;