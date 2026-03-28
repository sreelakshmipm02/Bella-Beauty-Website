import ProductVariant from "../../models/productVariant.js";

// ==========================================
// 1. FETCH ALL INVENTORY
// ==========================================
export const getInventoryList = async (page = 1, limit = 10, search = '', lowStockOnly = false) => {
    let query = {};

    if (search) {
        query.sku = { $regex: search, $options: 'i' };
    }

    if (lowStockOnly === 'true') {
        query.stock = { $lt: 10 }; // Filter for items with less than 10 units
    }

    const skip = (page - 1) * limit;

const variants = await ProductVariant.find(query)
    .populate('productId', 'name') // Add this to fetch the Product Name!
    .sort({ stock: 1 })
    .skip(skip)
    .limit(limit);
    const totalVariants = await ProductVariant.countDocuments(query);

    return { variants, totalVariants };
};

// ==========================================
// 2. QUICK STOCK UPDATE
// ==========================================
export const updateStockService = async (variantId, newStock) => {
    if (newStock < 0) throw new Error("Stock cannot be negative.");
    return await ProductVariant.findByIdAndUpdate(variantId, { stock: newStock }, { returnDocument: 'after' });
};