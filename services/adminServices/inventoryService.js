import ProductVariant from "../../models/productVariant.js";

// ---------------------------------------------------------
//  1. INVENTORY DATA RETRIEVAL
// ---------------------------------------------------------

/**
 * Fetches a paginated list of product variants.
 * Includes built-in support for SKU searching and low-stock filtering.
 */
export const getInventoryList = async (page = 1, limit = 10, search = '', lowStockOnly = false) => {
    let query = {};

    // Filter by SKU if a search term is provided
    if (search) {
        query.sku = { $regex: search, $options: 'i' };
    }

    // Quick filter for the 'Alerts' dashboard (Stock < 10)
    if (lowStockOnly === 'true') {
        query.stock = { $lt: 10 }; 
    }

    // Standard pagination math: skip the items from previous pages
    const skip = (page - 1) * limit;

    // We populate 'productId' to grab the parent product name for the table display
    const variants = await ProductVariant.find(query)
        .populate('productId', 'name') 
        .sort({ stock: 1 }) // Show items needing attention (lowest stock) first
        .skip(skip)
        .limit(limit);

    const totalVariants = await ProductVariant.countDocuments(query);

    return { variants, totalVariants };
};

// ---------------------------------------------------------
//  2. STOCK LEVEL MANAGEMENT
// ---------------------------------------------------------

/**
 * Updates the physical stock count for a specific variant.
 * Includes a basic safety check to prevent negative inventory.
 */
export const updateStockService = async (variantId, newStock) => {
    // Basic business logic validation
    if (newStock < 0) {
        throw new Error("Stock cannot be negative.");
    }

    // Return the updated document so the controller can confirm the change
    return await ProductVariant.findByIdAndUpdate(
        variantId, 
        { stock: newStock }, 
        { returnDocument: 'after' }
    );
};