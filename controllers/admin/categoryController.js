import {
    fetchCategoriesWithFilter,
    fetchAllAttributes,
    toggleCategoryStatus,
    createNewCategory,
    fetchCategoryById,
    updateCategoryById
} from "../../services/adminServices/categoryManagement.js";

import Category from "../../models/category.js";
// Renders the Category Management listing page.
export const categoryManagementPage = async (req, res) => {
    try {
        // Extract query parameters with defaults
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Categories per page
        const { status, search } = req.query;

        // Run fetches in parallel for speed
        const [categoryData, allAttributes] = await Promise.all([
            fetchCategoriesWithFilter(status, search, page, limit),
            fetchAllAttributes() 
        ]);

        const { categories, totalCategories } = categoryData;

        // Calculate total pages for frontend pagination logic
        const totalPages = Math.ceil(totalCategories / limit);

        // Render the view, passing all necessary variables
        res.render('admin/category', {
            categories,
            allAttributes,
            currentStatus: status || 'all',
            searchQuery: search || '', // Maintains the search text in the input
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


// Handle Final Category Submission (AJAX with FormData)
export const addCategorySubmit = async (req, res) => {
    try {
        const { name, description, status } = req.body;
        let categoryAttributes = req.body.categoryAttributes; 
        const adminId = req.session.adminId;

        if (!adminId) {
            return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
        }


        // If only one checkbox is selected, FormData sends it as a single string.
        if (!categoryAttributes) {
            categoryAttributes = [];
        } else if (!Array.isArray(categoryAttributes)) {
            categoryAttributes = [categoryAttributes];
        }

        let categoryImage = "";
        if (req.file) {
            // Using Cloudinary URL from Multer
            categoryImage = req.file.path; 
        }

        await createNewCategory({
            name,
            description,
            status,
            categoryImage,
            adminId,
            categoryAttributes // Pass the guaranteed array
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

//Handles the soft delete / restore action via AJAX/Fetch API.
export const softDeleteCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;

        // Call the service to toggle the status
        const newStatus = await toggleCategoryStatus(categoryId);

        // Return a JSON response for the SweetAlert to process
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

// Handle GET request to fetch category for the Edit Modal
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


// Handle PUT request to submit Edit Category Form
export const editCategorySubmit = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const bodyData = req.body;
        const fileData = req.file; // From Multer
        
        // Pass everything to the service layer
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



// ==========================================
// Fetch populated attributes for a specific category
// ==========================================
export const getCategoryAttributes = async (req, res) => {
    try {
        // Find the category by ID from the URL parameter
        // .populate() replaces the ObjectIds in 'categoryAttributes' with the actual full Attribute documents
        const category = await Category.findById(req.params.id).populate('categoryAttributes');
        
        if (!category) {
            return res.status(404).json({ 
                success: false, 
                message: "Category not found" 
            });
        }
        
        // Send the populated attributes array back to the frontend
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