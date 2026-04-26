import Category from "../../models/category.js";
import Product from "../../models/product.js";
import { getActiveOffers } from "../offerEngine.js";
import { applyOffersToProductCards } from "./offerViewHelpers.js";

// Pulls a clean list of all currently active categories.
// This feeds the category navigation bubbles on the homepage, ensuring 
// customers only see sections they can actually shop in right now.
export const getActiveCategories = async () => {
    return await Category.find({ status: 'active' }).sort({ createdAt: -1 });
};

// This is the heavy lifter for the homepage's "Featured Products" section.
// It doesn't just grab random products; it runs a strict series of checks using 
// a MongoDB aggregation pipeline to ensure we never display broken or unbuyable items to the customer.
export const getFeaturedProducts = async (limitCount = 4) => {
    const products = await Product.aggregate([
        // Check 1: The product itself must be marked 'active' by the admin.
        { $match: { status: 'active' } },
        
        // Check 2: We link to the Categories collection to verify the parent category.
        // If an admin temporarily disabled the entire "Skincare" category, 
        // we need to make sure Skincare products immediately drop off the homepage too.
        {
            $lookup: {
                from: 'categories',
                localField: 'categoryId',
                foreignField: '_id',
                as: 'categoryDetails'
            }
        },
        { $unwind: '$categoryDetails' },
        { $match: { 'categoryDetails.status': 'active' } },
        
        // Check 3: Pull in all the variants (Size, Color, etc.) belonging to this product.
        {
            $lookup: {
                from: 'productvariants',
                localField: '_id',
                foreignField: 'productId',
                as: 'variants'
            }
        },
        
        // Check 4: Filter the variants list so we are only looking at 'active' variants. 
        // We don't want to use an inactive/hidden variant to calculate the display price!
        {
            $addFields: {
                activeVariants: {
                    $filter: {
                        input: '$variants',
                        as: 'v',
                        cond: { $eq: ['$$v.status', 'active'] }
                    }
                }
            }
        },
        
        // Check 5: If all of a product's variants are inactive, the product essentially 
        // has nothing to sell. This safely filters that product out entirely.
        { $match: { 'activeVariants.0': { $exists: true } } },
        
        // The Polish: Now that we know the product is safe to sell, we dynamically calculate 
        // the "Starting at ₹___" price by finding the cheapest active variant. 
        // We also grab the very first image from the first variant to use as the display thumbnail.
        {
            $addFields: {
                startingPrice: { $min: '$activeVariants.price' },
                defaultImage: { $arrayElemAt: [{ $arrayElemAt: ['$activeVariants.images', 0] }, 0] }
            }
        },
        
        // Finally, sort them so the newest arrivals show up first, and cap the list 
        // at whatever limit the controller asked for (usually 4 for the homepage grid).
        { $sort: { createdAt: -1 } },
        { $limit: limitCount }
    ]);

    const offers = await getActiveOffers();
    return applyOffersToProductCards(products, offers);
};
