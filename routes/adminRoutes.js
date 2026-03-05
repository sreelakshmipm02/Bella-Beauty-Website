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
    softDeleteCategory,
    addCategorySubmit,
    getCategoryById,
    editCategorySubmit
} from "../controllers/admin/categoryController.js";

import { addAttributeSubmit,getAttributeForEdit,editAttributeSubmit,deleteAttributeSubmit } from "../controllers/admin/attributeController.js";

import { 
    checkAdminSession,
    preventCache } from "../middlewares/authMiddleware.js";

import { uploadCategory } from "../middlewares/upload.js";
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

//add new category
router.post('/category/add', checkAdminSession, uploadCategory.single('categoryImage'), addCategorySubmit);

// AJAX Route for creating attributes
router.post('/attributes/add', checkAdminSession, addAttributeSubmit);

// Get single category data (AJAX)
router.get('/category/:id', checkAdminSession, getCategoryById);

// Update category 
router.put('/category/edit/:id', checkAdminSession, uploadCategory.single('categoryImage'), editCategorySubmit);

//get single attribute data
router.get('/attributes/:id', checkAdminSession, getAttributeForEdit);

//update attribute
router.put('/attributes/edit/:id', checkAdminSession, editAttributeSubmit);

//delete attribute
router.delete('/attributes/:id', checkAdminSession, deleteAttributeSubmit);
export default router;