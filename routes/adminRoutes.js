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

import { 
    addAttributeSubmit,
    getAttributeForEdit,
    editAttributeSubmit,
    deleteAttributeSubmit 
} from "../controllers/admin/attributeController.js";

import { 
    checkAdminSession,
    preventCache 
} from "../middlewares/authMiddleware.js";

import { uploadCategory } from "../middlewares/upload.js";

const router = express.Router();

// ==========================================
// Authentication & Dashboard Routes
// ==========================================
router.get('/login', preventCache, adminLoginPage);
router.post('/login', adminLogin);
router.get('/dashboard', checkAdminSession, preventCache, dashboardPage);
router.get('/logout', adminLogout);

router.get("/forgot-password", adminForgotPasswordPage);
router.post("/forgot-password", adminForgotPasswordSubmit);
router.get("/reset-password/:token", adminResetPasswordPage);
router.post("/reset-password/:token", adminResetPasswordSubmit);

// ==========================================
// User Management Routes
// ==========================================
router.get('/user', checkAdminSession, preventCache, userManagementPage);
// RESTful: PATCH /resource/:id/property
router.patch('/user/:userId/status', checkAdminSession, toggleUserStatus); 

//-------------week1 completed-----------------------------------------------

// ==========================================
// Category Management Routes (RESTful)
// ==========================================
// Get category listing page
router.get('/category', checkAdminSession, preventCache, categoryManagementPage);

// Create new category
router.post('/category', checkAdminSession, uploadCategory.single('categoryImage'), addCategorySubmit);

// Get single category data (AJAX)
router.get('/category/:id', checkAdminSession, getCategoryById);

// Update entire category
router.put('/category/:id', checkAdminSession, uploadCategory.single('categoryImage'), editCategorySubmit);

// Update category status (Soft Delete)
router.patch('/category/:categoryId/status', checkAdminSession, softDeleteCategory);


// ==========================================
// Attribute Management Routes (RESTful)
// ==========================================
// Create new attribute
router.post('/attributes', checkAdminSession, addAttributeSubmit);

// Get single attribute data
router.get('/attributes/:id', checkAdminSession, getAttributeForEdit);

// Update attribute
router.put('/attributes/:id', checkAdminSession, editAttributeSubmit);

// Delete attribute
router.delete('/attributes/:id', checkAdminSession, deleteAttributeSubmit);

export default router;