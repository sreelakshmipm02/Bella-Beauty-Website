import { getInventoryList, updateStockService } from "../../services/adminServices/inventoryService.js";

/**
 * Renders the main inventory management dashboard.
 * We use server-side pagination and filtering here to keep 
 * the page fast even as the product list grows.
 */
export const getInventoryPage = async (req, res) => {
    try {
        // Parse pagination and filter settings from the URL
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const { search, lowStock } = req.query;

        // Fetch data through the service layer to keep the controller lean
        const { variants, totalVariants } = await getInventoryList(page, limit, search, lowStock);
        const totalPages = Math.ceil(totalVariants / limit);

        // Pass everything to the view, including the current filters 
        // so the UI can highlight what the user is looking at.
        res.render("admin/inventory", {
            title: "Inventory Management",
            variants,
            currentPage: page,
            totalPages,
            searchQuery: search || '',
            lowStockFilter: lowStock === 'true'
        });
    } catch (error) {
        // Log the actual error for debugging and redirect the admin safely
        console.error("Inventory Page Error:", error);
        res.redirect("/admin/dashboard");
    }
};

/**
 * Updates stock levels via AJAX.
 * This is meant to be called from a modal or an inline edit field 
 * to avoid refreshing the entire inventory table.
 */
export const updateStockAjax = async (req, res) => {
    try {
        const { variantId, stock } = req.body;
        
        // Update the database via the service
        await updateStockService(variantId, stock);
        
        res.json({ 
            success: true, 
            message: "Stock updated successfully." 
        });
    } catch (error) {
        // We return a 400 (Bad Request) so the frontend 'catch' block 
        // triggers and can display the specific error message to the admin.
        res.status(400).json({ 
            success: false, 
            message: error.message || "Something went wrong while updating stock." 
        });
    }
};