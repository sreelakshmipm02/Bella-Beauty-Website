import { 
    fetchCategoriesWithFilter, 
    toggleCategoryStatus 
} from "../../services/adminServices/categoryManagement.js";

/**
 * Renders the Category Management listing page.
 */
export const categoryManagementPage = async (req, res) => {
    try {
        // Extract query parameters with defaults
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Categories per page
        const { status, search } = req.query;

        // Call the service to get filtered, sorted, and paginated data
        const { categories, totalCategories } = await fetchCategoriesWithFilter(status, search, page, limit);
        
        // Calculate total pages for frontend pagination logic
        const totalPages = Math.ceil(totalCategories / limit);

        // Render the view, passing all necessary variables
        res.render('admin/category', {
            categories,
            currentStatus: status || 'all',
            searchQuery: search || '', // Maintains the search text in the input
            currentPage: page,
            totalPages,
            totalCategories,
            limit
        });
    } catch (error) {
        console.error("Category Management Error:", error);
        // You could also render an error page or redirect here
        res.status(500).send("Error fetching categories");
    }
};

/**
 * Handles the soft delete / restore action via AJAX/Fetch API.
 */
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