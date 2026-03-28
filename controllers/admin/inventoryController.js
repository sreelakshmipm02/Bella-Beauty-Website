import { getInventoryList, updateStockService } from "../../services/adminServices/inventoryService.js";

export const getInventoryPage = async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Inventory Page Error:", error);
        res.redirect("/admin/dashboard");
    }
};

export const updateStockAjax = async (req, res) => {
    try {
        const { variantId, stock } = req.body;
        await updateStockService(variantId, stock);
        res.json({ success: true, message: "Stock updated successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};