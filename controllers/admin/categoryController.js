import {
    fetchCategoriesWithFilter,
    fetchAllAttributes,
    toggleCategoryStatus,
    createNewCategory,
    fetchCategoryById,
    updateCategoryById
} from "../../services/adminServices/categoryManagement.js";

import Category from "../../models/category.js";

// Serves as the main entry point for the Admin Category Dashboard.
// We grab all the required data (categories for the table, attributes for the 'Add' modal) 
// in parallel to ensure the page loads as quickly as possible.
export const categoryManagementPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5; 
        const { status, search } = req.query;

        // Fetching categories and attributes simultaneously prevents waterfall delays
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
            searchQuery: search || '', // Keep the search bar populated after a page reload
            currentPage: page,
            totalPages,
            totalCategories,
            limit
        });
    } catch (error) {
        console.error("Category Management Error:", error);
        res.status(500).send("Error fetching categories");
    }
};

// Catches the AJAX request from the 'Add Category' modal.
// Since this form includes an image, it arrives as multipart/form-data.
export const addCategorySubmit = async (req, res) => {
    try {
        const { name, description, status } = req.body;
        let categoryAttributes = req.body.categoryAttributes; 
        const adminId = req.session.adminId;

        if (!adminId) {
            return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
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

        res.status(200).json({ 
            success: true, 
            message: "Category added successfully." 
        });

    } catch (error) {
        console.error("Add Category Error:", error);
        res.status(400).json({ 
            success: false, 
            message: error.message || "Failed to add category." 
        });
    }
};

// We use a 'soft delete' approach for categories instead of permanently erasing them.
// If we permanently deleted a category, any existing products tied to it would break!
// This endpoint just flips the status and sends a quick JSON response so the UI updates instantly.
export const softDeleteCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;

        const newStatus = await toggleCategoryStatus(categoryId);

        res.json({
            success: true,
            message: `Category successfully ${newStatus === 'active' ? 'restored' : 'soft deleted'}.`,
            newStatus: newStatus
        });
    } catch (error) {
        console.error("Soft Delete Error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update category status."
        });
    }
};

// Feeds the 'Edit Category' modal on the frontend.
// When an admin clicks the edit button, we fetch the absolute latest data from the database 
// to populate the form fields, ensuring they don't accidentally overwrite recent changes.
export const getCategoryById = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const category = await fetchCategoryById(categoryId);
        
        res.status(200).json({ success: true, category });
    } catch (error) {
        console.error("Fetch Category Error:", error);
        res.status(404).json({ success: false, message: error.message });
    }
};

// Captures the updated data when an admin hits save on the Edit modal.
// We pass both the text fields (bodyData) and the potentially new image (fileData) 
// down to the service layer to handle the complex update logic.
export const editCategorySubmit = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const bodyData = req.body;
        const fileData = req.file; 
        
        await updateCategoryById(categoryId, bodyData, fileData);

        res.status(200).json({ 
            success: true, 
            message: "Category updated successfully." 
        });
    } catch (error) {
        console.error("Edit Category Error:", error);
        res.status(400).json({ 
            success: false, 
            message: error.message || "An error occurred while updating." 
        });
    }
};

// This is a critical helper endpoint for the 'Add Product' page.
// When an admin selects a Category from the dropdown while creating a product, 
// the frontend calls this endpoint to find out exactly which dynamic attributes (Size, Color, etc.) 
// belong to that category so it can render the correct input fields on the screen.
export const getCategoryAttributes = async (req, res) => {
    try {
        // We use Mongoose's .populate() to transform the array of raw Attribute IDs 
        // into an array of actual, fully-detailed Attribute objects.
        const category = await Category.findById(req.params.id).populate('categoryAttributes');
        
        if (!category) {
            return res.status(404).json({ 
                success: false, 
                message: "Category not found" 
            });
        }
        
        res.json({ 
            success: true, 
            attributes: category.categoryAttributes 
        });
        
    } catch (error) {
        console.error("Error fetching category attributes:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error while fetching attributes." 
        });
    }
};