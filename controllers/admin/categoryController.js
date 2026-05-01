import {
    fetchCategoriesWithFilter,
    fetchAllAttributes,
    toggleCategoryStatus,
    createNewCategory,
    fetchCategoryById,
    updateCategoryById
} from "../../services/adminServices/categoryManagement.js";

import Category from "../../models/category.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";

// Serves as the main entry point for the Admin Category Dashboard.
// We grab all the required data (categories for the table, attributes for the 'Add' modal) 
// in parallel to ensure the page loads as quickly as possible.
export const categoryManagementPage = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const { status, search } = req.query;

    const [categoryData, allAttributes] = await Promise.all([
        fetchCategoriesWithFilter(status, search, page, limit),
        fetchAllAttributes()
    ]);

    const { categories, totalCategories } = categoryData;
    const totalPages = Math.ceil(totalCategories / limit);

    res.render('admin/category', {
        categories,
        allAttributes,
        currentStatus: status || 'all',
        searchQuery: search || '',
        currentPage: page,
        totalPages,
        totalCategories,
        limit
    });
});

// Catches the AJAX request from the 'Add Category' modal.
// Since this form includes an image, it arrives as multipart/form-data.
export const addCategorySubmit = asyncHandler(async (req, res) => {
        const { name, description, status } = req.body;
        let categoryAttributes = req.body.categoryAttributes;
        const adminId = req.session.adminId;

        if (!adminId) {
            throw new AppError("Unauthorized. Please log in.", 401);
        }

        // HTML forms are tricky: if an admin selects multiple attributes, it sends an array. 
        // But if they only select ONE attribute, it sends a plain string. 
        // We force it into an array here so our database always receives consistent data.
        if (!categoryAttributes) {
            categoryAttributes = [];
        } else if (!Array.isArray(categoryAttributes)) {
            categoryAttributes = [categoryAttributes];
        }

        // Multer processes the image upload to Cloudinary before the request even hits this controller.
        // We just need to grab the secure Cloudinary URL it leaves behind in req.file.path.
        let categoryImage = "";
        if (req.file) {
            categoryImage = req.file.path; 
        }

        await createNewCategory({
            name,
            description,
            status,
            categoryImage,
            adminId,
            categoryAttributes
        });

        res.status(201).json({ 
            success: true, 
            message: "Category added successfully." 
        });
});

// We use a 'soft delete' approach for categories instead of permanently erasing them.
// If we permanently deleted a category, any existing products tied to it would break!
// This endpoint just flips the status and sends a quick JSON response so the UI updates instantly.
export const softDeleteCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const newStatus = await toggleCategoryStatus(categoryId);

    res.status(200).json({
        success: true,
        message: `Category successfully ${newStatus === 'active' ? 'restored' : 'soft deleted'}.`,
        newStatus: newStatus
    });
});

// Feeds the 'Edit Category' modal on the frontend.
// When an admin clicks the edit button, we fetch the absolute latest data from the database 
// to populate the form fields, ensuring they don't accidentally overwrite recent changes.
export const getCategoryById = asyncHandler(async (req, res) => {
    const categoryId = req.params.id;
    const category = await fetchCategoryById(categoryId);
    res.status(200).json({ success: true, category });
});

// Captures the updated data when an admin hits save on the Edit modal.
// We pass both the text fields (bodyData) and the potentially new image (fileData) 
// down to the service layer to handle the complex update logic.
export const editCategorySubmit = asyncHandler(async (req, res) => {
    const categoryId = req.params.id;
    const bodyData = req.body;
    const fileData = req.file;
    await updateCategoryById(categoryId, bodyData, fileData);

    res.status(200).json({
        success: true,
        message: "Category updated successfully."
    });
});

// This is a critical helper endpoint for the 'Add Product' page.
// When an admin selects a Category from the dropdown while creating a product, 
// the frontend calls this endpoint to find out exactly which dynamic attributes (Size, Color, etc.) 
// belong to that category so it can render the correct input fields on the screen.
export const getCategoryAttributes = asyncHandler(async (req, res) => {
    const category = await Category.findById(req.params.id).populate('categoryAttributes');
    if (!category) {
        throw new AppError("Category not found", 404);
    }

    res.status(200).json({
        success: true,
        attributes: category.categoryAttributes
    });
});
