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
import {
    getCouponsPage,
    createCoupon,
    getCouponDetails,
    updateCoupon,
    toggleCouponStatus
} from "../controllers/admin/couponController.js";

const router = express.Router();

// ---------------------------------------------------------
//  AUTH & ACCOUNT ACCESS
// ---------------------------------------------------------
router.get('/login', preventCache, adminLoginPage);
router.post('/login', adminLogin);
router.get('/logout', adminLogout);

// Password recovery flow
router.get("/forgot-password", adminForgotPasswordPage);
router.post("/forgot-password", adminForgotPasswordSubmit);
router.get("/reset-password/:token", adminResetPasswordPage);
router.post("/reset-password/:token", adminResetPasswordSubmit);

// ---------------------------------------------------------
//  DASHBOARD & USER METRICS
// ---------------------------------------------------------
router.get('/dashboard', checkAdminSession, preventCache, dashboardPage);
router.get('/user', checkAdminSession, preventCache, userManagementPage);

// Using PATCH here because we're only flipping the active/blocked status
router.patch('/user/:userId/status', checkAdminSession, toggleUserStatus); 

// ---------------------------------------------------------
//  CATEGORY & ATTRIBUTE SETUP
// ---------------------------------------------------------
router.get('/category', checkAdminSession, preventCache, categoryManagementPage);
router.post('/category', checkAdminSession, uploadCategory.single('categoryImage'), addCategorySubmit);
router.get('/category/:id', checkAdminSession, getCategoryById);
router.put('/category/:id', checkAdminSession, uploadCategory.single('categoryImage'), editCategorySubmit);
router.patch('/category/:categoryId/status', checkAdminSession, softDeleteCategory);

// Global product attributes (Size, Color, etc.)
router.post('/attributes', checkAdminSession, addAttributeSubmit);
router.get('/attributes/:id', checkAdminSession, getAttributeForEdit);
router.put('/attributes/:id', checkAdminSession, editAttributeSubmit);
router.delete('/attributes/:id', checkAdminSession, deleteAttributeSubmit);

// ---------------------------------------------------------
//  PRODUCT CATALOG
// ---------------------------------------------------------
router.get('/products', checkAdminSession, preventCache, getProductsPage);
router.get('/products/new', checkAdminSession, preventCache, getAddProductPage);

// Fetches the specific fields (like sizes) when a category is picked in the UI
router.get('/category/:id/attributes', checkAdminSession, getCategoryAttributes);

// Using .any() because variant images come in as dynamic field names (image_0, image_1, etc.)
router.post('/products', checkAdminSession, uploadProduct.any(), createProduct);
router.get('/products/:id/edit', checkAdminSession, preventCache, getEditProductPage);
router.put('/products/:id', checkAdminSession, uploadProduct.any(), updateProduct);
router.patch('/products/:id/status', checkAdminSession, toggleProductStatus);

// ---------------------------------------------------------
//  ORDERS & RETURNS
// ---------------------------------------------------------
router.get('/orders', checkAdminSession, preventCache, getOrdersPage);
router.get('/orders/:id', checkAdminSession, preventCache, getAdminOrderDetailPage);

// Quick status updates via AJAX to avoid full page reloads
router.patch('/orders/:id/status', checkAdminSession, updateOrderStatusAjax);
router.patch('/orders/:id/payment-status', checkAdminSession, updatePaymentStatusAjax);
router.post('/orders/:orderId/items/:itemId/process-return', checkAdminSession, processReturnAjax);

// ---------------------------------------------------------
//  STOCK MANAGEMENT
// ---------------------------------------------------------
router.get('/inventory', checkAdminSession, preventCache, getInventoryPage);
router.patch('/inventory/stock', checkAdminSession, updateStockAjax);

// ---------------------------------------------------------
//  COUPON MANAGEMENT
// ---------------------------------------------------------
router.get('/coupons', checkAdminSession, preventCache, getCouponsPage);
router.post('/coupons', checkAdminSession, createCoupon);
router.get('/coupons/:id', checkAdminSession, getCouponDetails);
router.put('/coupons/:id', checkAdminSession, updateCoupon);
router.patch('/coupons/:id/status', checkAdminSession, toggleCouponStatus);

export default router;
