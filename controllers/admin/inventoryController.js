import { getInventoryList, updateBulkStockService, updateStockService } from "../../services/adminServices/inventoryService.js";

/**
 * Show the inventory page with pagination and filters.
 * Keeps the page fast by loading only needed data.
 */
export const getInventoryPage = async (req, res) => {
    try {
        // Get page number and filters from query
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const { search, lowStock } = req.query;

        // Get data from service
        const { variants, totalVariants } = await getInventoryList(page, limit, search, lowStock);
        const totalPages = Math.ceil(totalVariants / limit);

        // Send data to the view
        res.render("admin/inventory", {
            title: "Inventory Management",
            variants,
            currentPage: page,
            totalPages,
            searchQuery: search || '',
            lowStockFilter: lowStock === 'true'
        });
    } catch (error) {
        // Log error and redirect safely
        console.error("Inventory Page Error:", error);
        res.redirect("/admin/dashboard");
    }
};

/**
 * Update stock using AJAX (no page reload needed).
 */
export const updateStockAjax = async (req, res) => {
    try {
        const { variantId, stock, updates } = req.body;

        if (Array.isArray(updates)) {
            await updateBulkStockService(updates);
            return res.json({
                success: true,
                message: "All stock changes were updated successfully."
            });
        }

        await updateStockService(variantId, stock);
        
        res.json({ 
            success: true, 
            message: "Stock updated successfully." 
        });
    } catch (error) {
        // Send error back so frontend can handle it
        res.status(400).json({ 
            success: false, 
            message: error.message || "Something went wrong while updating stock." 
        });
    }
};
