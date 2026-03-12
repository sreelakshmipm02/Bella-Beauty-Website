import Product from "../../models/product.js";
import Category from "../../models/category.js";
import mongoose from "mongoose";

export const getShopPage = async (req, res) => {
    try {
        // 1. Capture Query Parameters
        const page = parseInt(req.query.page) || 1;
        const limit = 9; // Show 9 products per page
        const skip = (page - 1) * limit;

        const { search, category, brand, sort, minPrice, maxPrice } = req.query;

        // 2. Build the Aggregation Pipeline
        let pipeline = [];

        // CONSTRAINT: Hide blocked/unlisted products
        pipeline.push({ $match: { status: 'active' } });

        // Ensure Category is also active
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

        // FILTER: By Category
        if (category) {
            pipeline.push({ $match: { 'categoryDetails._id': new mongoose.Types.ObjectId(category) } });
        }

        // FILTER: By Brand
        if (brand) {
            pipeline.push({ $match: { brand: brand } });
        }

        // FILTER: By Search (Checks both Name and Brand)
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

        // LOOKUP: Fetch Variants to calculate price and stock
        pipeline.push({
            $lookup: {
                from: 'productvariants',
                localField: '_id',
                foreignField: 'productId',
                as: 'variants'
            }
        });

        // Keep only active variants
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

        // Must have at least 1 active variant to be shown
        pipeline.push({ $match: { 'activeVariants.0': { $exists: true } } });

        // CALCULATE: Starting Price and Default Image from variants
        pipeline.push({
            $addFields: {
                startingPrice: { $min: '$activeVariants.price' },
                totalStock: { $sum: '$activeVariants.stock' },
                defaultImage: { $arrayElemAt: [{ $arrayElemAt: ['$activeVariants.images', 0] }, 0] }
            }
        });

        // FILTER: By Price Range (Calculated off the startingPrice)
        if (minPrice || maxPrice) {
            let priceMatch = {};
            if (minPrice) priceMatch.$gte = parseInt(minPrice);
            if (maxPrice) priceMatch.$lte = parseInt(maxPrice);
            pipeline.push({ $match: { startingPrice: priceMatch } });
        }

        // SORTING Options
        let sortStage = { createdAt: -1 }; // Default: Newest First
        if (sort === 'price_asc') sortStage = { startingPrice: 1 };
        else if (sort === 'price_desc') sortStage = { startingPrice: -1 };
        else if (sort === 'name_asc') sortStage = { name: 1 };
        else if (sort === 'name_desc') sortStage = { name: -1 };
        
        pipeline.push({ $sort: sortStage });

        // PAGINATION & EXECUTION 
        pipeline.push({
            $facet: {
                metadata: [{ $count: "total" }],
                data: [{ $skip: skip }, { $limit: limit }]
            }
        });

        const result = await Product.aggregate(pipeline);
        const products = result[0].data;
        const totalProducts = result[0].metadata[0] ? result[0].metadata[0].total : 0;
        const totalPages = Math.ceil(totalProducts / limit);

        // Fetch Data for Sidebar Dropdowns
        const categories = await Category.find({ status: 'active' }).sort({ name: 1 });
        const brands = await Product.distinct('brand', { status: 'active' });

        // Render Page
        res.render("user/shop", {
            title: "Shop - Bella Beauty",
            isLoggedIn: !!req.session.userId,
            products,
            categories,
            brands,
            currentPage: page,
            totalPages,
            totalProducts,
            query: req.query // Pass query back so inputs stay filled!
        });

    } catch (error) {
        console.error("Shop Page Error:", error);
        res.redirect("/");
    }
};