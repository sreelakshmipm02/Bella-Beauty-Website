import ProductVariant from "../../models/productVariant.js";
import AppError from "../../utils/AppError.js";

// ---------------------------------------------------------
//  1. GET INVENTORY DATA
// ---------------------------------------------------------

/**
 * Get product variants with pagination.
 * You can also search by SKU and filter low stock items.
 */
export const getInventoryList = async (page = 1, limit = 10, search = '', lowStockOnly = false) => {
    let query = {};

    // If user searches something, match it with SKU (not case-sensitive)
    if (search) {
        query.sku = { $regex: search, $options: 'i' };
    }

    // If low stock filter is enabled, show items with stock less than 10
    if (lowStockOnly === 'true') {
        query.stock = { $lt: 10 }; 
    }

    // Calculate how many items to skip for pagination
    const skip = (page - 1) * limit;

    // Get variants from DB
    // Also get product name using populate
    const variants = await ProductVariant.find(query)
        .populate('productId', 'name') 
        .sort({ stock: 1 }) // show low stock items first
        .skip(skip)
        .limit(limit);

    // Get total count for pagination
    const totalVariants = await ProductVariant.countDocuments(query);

    return { variants, totalVariants };
};

// ---------------------------------------------------------
//  2. UPDATE STOCK
// ---------------------------------------------------------

/**
 * Update stock of a specific product variant.
 * Make sure stock is not negative.
 */
export const updateStockService = async (variantId, newStock) => {
    // Do not allow negative stock
    if (newStock < 0) {
        throw new AppError("Stock cannot be negative.", 400);
    }

    // Update stock and return updated data
    const updatedVariant = await ProductVariant.findByIdAndUpdate(
        variantId, 
        { stock: newStock }, 
        { returnDocument: 'after' }
    );

    if (!updatedVariant) {
        throw new AppError("Variant not found.", 404);
    }

    return updatedVariant;
};

/**
 * Update stock for multiple variants in one request.
 */
export const updateBulkStockService = async (updates = []) => {
    if (!Array.isArray(updates) || updates.length === 0) {
        throw new AppError("No stock updates were provided.", 400);
    }

    const operations = updates.map(({ variantId, stock }) => {
        const parsedStock = Number(stock);

        if (!variantId) {
            throw new AppError("Each stock update must include a variant ID.", 400);
        }

        if (!Number.isInteger(parsedStock) || parsedStock < 0) {
            throw new AppError("Stock must be a non-negative whole number.", 400);
        }

        return {
            updateOne: {
                filter: { _id: variantId },
                update: { $set: { stock: parsedStock } }
            }
        };
    });

    const result = await ProductVariant.bulkWrite(operations);

    if (result.matchedCount === 0) {
        throw new AppError("No matching variants were found.", 404);
    }

    return result;
};
