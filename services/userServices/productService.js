import Product from "../../models/product.js";
import Category from "../../models/category.js";
import Attribute from "../../models/attribute.js";
import ProductVariant from "../../models/productVariant.js";
import mongoose from "mongoose";
import { getActiveOffers } from "../offerEngine.js";
import { applyOffersToProductCards, applyOfferToVariantView } from "./offerViewHelpers.js";

// ==========================================
// SHOP PAGE SERVICES
// ==========================================

// This is the absolute powerhouse of the customer-facing store. 
// Instead of making multiple database calls, we dynamically build a single MongoDB 
// Aggregation Pipeline based on whatever filters the user clicked on the frontend.
export const getShopData = async (queryFilters, skip, limit) => {
    const { search, category, brand, productType, sort, minPrice, maxPrice } = queryFilters;
    let pipeline = [];

    // Rule 1: Never show a product if an admin has marked it as 'inactive'.
    pipeline.push({ $match: { status: 'active' } });

    // Rule 2: Even if the product is active, we must check its parent category.
    // If an admin disables the entire "Makeup" category, all makeup products 
    // must instantly disappear from the shop page.
    pipeline.push({
        $lookup: {
            from: 'categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'categoryDetails'
        }
    });
    pipeline.push({ $unwind: '$categoryDetails' });
    pipeline.push({ $match: { 'categoryDetails.status': 'active' } });

    // Apply exact match filters if the user clicked them in the sidebar
    if (category && mongoose.Types.ObjectId.isValid(category)) {
        pipeline.push({ $match: { 'categoryDetails._id': new mongoose.Types.ObjectId(category) } });
    }

    if (brand) {
        pipeline.push({ $match: { brand: brand } });
    }

    //Filter by Product Type (Supports single string or array of checkboxes)
    if (productType) {
        if (Array.isArray(productType)) {
            pipeline.push({ $match: { productType: { $in: productType } } });
        } else {
            pipeline.push({ $match: { productType: productType } });
        }
    }

    // If the user typed something into the search bar, look for partial matches 
    // in both the product's name and its brand.
    if (search) {
        pipeline.push({
            $match: {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { brand: { $regex: search, $options: 'i' } }
                ]
            }
        });
    }

    // Rule 3: A product is useless if it has no variants (sizes/colors) to actually sell.
    // We pull in all variants and filter out any that the admin marked as inactive.
    pipeline.push({
        $lookup: {
            from: 'productvariants',
            localField: '_id',
            foreignField: 'productId',
            as: 'variants'
        }
    });

    pipeline.push({
        $addFields: {
            activeVariants: {
                $filter: {
                    input: '$variants',
                    as: 'v',
                    cond: { $eq: ['$$v.status', 'active'] }
                }
            }
        }
    });

    // If the active variants list is empty, drop the product entirely.
    pipeline.push({ $match: { 'activeVariants.0': { $exists: true } } });

    // UX Polish: We calculate the lowest price among all active variants to show as the 
    // "Starting at ₹X" price. We also grab the first image to use as the product card thumbnail.
    pipeline.push({
        $addFields: {
            startingPrice: { $min: '$activeVariants.price' },
            totalStock: { $sum: '$activeVariants.stock' },
            defaultImage: { $arrayElemAt: [{ $arrayElemAt: ['$activeVariants.images', 0] }, 0] }
        }
    });

    // Apply the price range filter. We do this down here because we had to calculate 
    // the 'startingPrice' first before we could filter by it!
    if (minPrice || maxPrice) {
        let priceMatch = {};
        if (minPrice) priceMatch.$gte = parseInt(minPrice);
        if (maxPrice) priceMatch.$lte = parseInt(maxPrice);
        pipeline.push({ $match: { startingPrice: priceMatch } });
    }

    // Sort the results based on the dropdown selector (Price High->Low, Name A->Z, etc.)
    let sortStage = { createdAt: -1 }; 
    if (sort === 'price_asc') sortStage = { startingPrice: 1 };
    else if (sort === 'price_desc') sortStage = { startingPrice: -1 };
    else if (sort === 'name_asc') sortStage = { name: 1 };
    else if (sort === 'name_desc') sortStage = { name: -1 };
    
    pipeline.push({ $sort: sortStage });

    // The Grand Finale: We use $facet to run two operations at once.
    // 1. Count the total number of products that matched ALL these rules (for pagination buttons).
    // 2. Actually slice the data to return just the 9 products for the current page.
    pipeline.push({
        $facet: {
            metadata: [{ $count: "total" }],
            data: [{ $skip: skip }, { $limit: limit }]
        }
    });

    const result = await Product.aggregate(pipeline);
    const offers = await getActiveOffers();
    const products = applyOffersToProductCards(result[0].data, offers);
    const totalProducts = result[0].metadata[0] ? result[0].metadata[0].total : 0;
    
    return { products, totalProducts };
};

// Feeds the sidebar filters on the Shop page. 
// We only return 'active' items so users don't see checkboxes for categories that are currently hidden.
export const getActiveCategories = async () => {
    return await Category.find({ status: 'active' }).sort({ name: 1 });
};

export const getActiveBrands = async () => {
    return await Product.distinct('brand', { status: 'active' });
};

//Fetch active product types for the sidebar
export const getActiveProductTypes = async () => {
    const types = await Product.distinct('productType', { status: 'active' });
    return types.filter(type => type != null && type.trim() !== '');
};

// ==========================================
// PRODUCT DETAIL PAGE (PDP) SERVICES
// ==========================================

// Fetches the core product document using the URL slug (e.g., "soothing-body-butter")
export const getProductBySlug = async (slug) => {
    return await Product.findOne({ slug });
};

// Fetches the parent category to build the breadcrumb trail at the top of the page.
export const getCategoryById = async (categoryId) => {
    return await Category.findById(categoryId);
};

// Grabs all the active variants so the frontend can build the size/color selector buttons.
export const getActiveVariants = async (productId) => {
    return await ProductVariant.find({ productId, status: 'active' });
};

export const enrichVariantsWithOffers = async (product, variants) => {
    const offers = await getActiveOffers();
    return variants.map((variant) => applyOfferToVariantView(variant.toObject ? variant.toObject() : variant, product, offers));
};

// Translates the raw attribute IDs saved on the variants into human-readable 
// labels like "Size" or "Shade" for the UI.
export const getAttributesByIds = async (attributeIds) => {
    return await Attribute.find({ _id: { $in: attributeIds } });
};

// Builds the "You May Also Like" carousel at the bottom of the page.
// It searches for other active products in the same exact category, specifically 
// excluding the product the user is currently looking at so it doesn't recommend itself!
export const getRelatedProducts = async (categoryId, currentProductId, limit = 4) => {
    const relatedProducts = await Product.aggregate([
        { $match: { categoryId: categoryId, status: 'active', _id: { $ne: currentProductId } } },
        { $lookup: { from: 'productvariants', localField: '_id', foreignField: 'productId', as: 'variants' } },
        { $addFields: { activeVariants: { $filter: { input: '$variants', as: 'v', cond: { $eq: ['$$v.status', 'active'] } } } } },
        { $match: { 'activeVariants.0': { $exists: true } } }, 
        { $addFields: { startingPrice: { $min: '$activeVariants.price' }, defaultImage: { $arrayElemAt: [{ $arrayElemAt: ['$activeVariants.images', 0] }, 0] } } },
        { $limit: limit }
    ]);

    const offers = await getActiveOffers();
    return applyOffersToProductCards(relatedProducts, offers);
};
