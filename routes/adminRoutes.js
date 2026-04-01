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
    editCategorySubmit,
    getCategoryAttributes
} from "../controllers/admin/categoryController.js";

import { 
    addAttributeSubmit,
    getAttributeForEdit,
    editAttributeSubmit,
    deleteAttributeSubmit 
} from "../controllers/admin/attributeController.js";

import { 
    getProductsPage, 
    getAddProductPage, 
    createProduct, 
    toggleProductStatus,
    getEditProductPage,
    updateProduct
 } from "../controllers/admin/productController.js";

 import { 
    getOrdersPage, 
    getAdminOrderDetailPage, 
    updateOrderStatusAjax,
    processReturnAjax,
    updatePaymentStatusAjax
} from "../controllers/admin/orderController.js";

import { 
    checkAdminSession,
    preventCache 
} from "../middlewares/authMiddleware.js";

import { 
    uploadCategory,
    uploadProduct 
} from "../middlewares/upload.js";

import { 
    getInventoryPage, 
    updateStockAjax 
} from "../controllers/admin/inventoryController.js";
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

// ==========================================
// Product Management Routes (RESTful)
// ==========================================

// Product Management Listing
router.get('/products', checkAdminSession, preventCache, getProductsPage);
// Add Product Page
router.get('/products/new', checkAdminSession, preventCache, getAddProductPage);
// Fetch dynamic attributes when category is selected
router.get('/category/:id/attributes', checkAdminSession, getCategoryAttributes);

// We use `.any()` because the field names are dynamic (variant_images_0, variant_images_1, etc.)
router.post('/products', checkAdminSession, uploadProduct.any(), createProduct);

router.patch('/products/:id/status', checkAdminSession, toggleProductStatus);

router.get('/products/:id/edit', checkAdminSession, preventCache, getEditProductPage);

router.put('/products/:id', checkAdminSession, uploadProduct.any(), updateProduct);

// ==========================================
// Order Management Routes (RESTful)
// ==========================================
// Get list of orders
router.get('/orders', checkAdminSession, preventCache, getOrdersPage);

// Get specific order details
router.get('/orders/:id', checkAdminSession, preventCache, getAdminOrderDetailPage);

// Update order status (PATCH updates a specific field on a resource)
router.patch('/orders/:id/status', checkAdminSession, updateOrderStatusAjax);
// Add this in your Order Management section
router.patch('/orders/:id/payment-status', checkAdminSession, updatePaymentStatusAjax);
router.post('/orders/:orderId/items/:itemId/process-return', checkAdminSession, processReturnAjax);

// Inventory Management
router.get('/inventory', checkAdminSession, preventCache, getInventoryPage);
router.patch('/inventory/stock', checkAdminSession, updateStockAjax);

export default router;