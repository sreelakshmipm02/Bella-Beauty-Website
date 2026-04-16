import { getInventoryList, updateBulkStockService, updateStockService } from "../../services/adminServices/inventoryService.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";

/**
 * Show the inventory page with pagination and filters.
 * Keeps the page fast by loading only needed data.
 */
export const getInventoryPage = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const { search, lowStock } = req.query;

    const { variants, totalVariants } = await getInventoryList(page, limit, search, lowStock);
    const totalPages = Math.ceil(totalVariants / limit);

    res.render("admin/inventory", {
        title: "Inventory Management",
        variants,
        currentPage: page,
        totalPages,
        searchQuery: search || '',
        lowStockFilter: lowStock === 'true'
    });
});

/**
 * Update stock using AJAX (no page reload needed).
 */
export const updateStockAjax = asyncHandler(async (req, res) => {
    const { variantId, stock, updates } = req.body;

    if (Array.isArray(updates)) {
        await updateBulkStockService(updates);
        return res.status(200).json({
            success: true,
            message: "All stock changes were updated successfully."
        });
    }

    await updateStockService(variantId, stock);
    
    res.status(200).json({ 
        success: true, 
        message: "Stock updated successfully." 
    });
});
