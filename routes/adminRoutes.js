import express from "express";
import {
    adminLoginPage,
    adminLogin,
    dashboardPage
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

export default router;