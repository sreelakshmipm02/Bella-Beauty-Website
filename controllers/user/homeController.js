import Category from "../../models/category.js";
import Product from "../../models/product.js";

export const getHomePage = async (req, res) => {
    try {
        const isLoggedIn = !!req.session.userId;

        // 1. Fetch exactly 3 Active Categories for the circular grid
        const categories = await Category.find({ status: 'active' })
            .sort({ createdAt: -1 });

        // 2. Fetch 4 "Featured" Products using the same robust aggregation logic
        const featuredProducts = await Product.aggregate([
            { $match: { status: 'active' } },
            // Ensure the category is also active
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
            // Get Variants
            {
                $lookup: {
                    from: 'productvariants',
                    localField: '_id',
                    foreignField: 'productId',
                    as: 'variants'
                }
            },
            // Keep only active variants
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
            // Must have at least 1 active variant
            { $match: { 'activeVariants.0': { $exists: true } } },
            // Calculate starting price and grab the first image
            {
                $addFields: {
                    startingPrice: { $min: '$activeVariants.price' },
                    defaultImage: { $arrayElemAt: [{ $arrayElemAt: ['$activeVariants.images', 0] }, 0] }
                }
            },
            // Sort by newest and limit to 4
            { $sort: { createdAt: -1 } },
            { $limit: 4 }
        ]);

        // 3. Render the home page with dynamic data
        res.render("user/home", {
            title: "Bella Beauty",
            isLoggedIn,
            categories,
            featuredProducts
        });

    } catch (error) {
        console.error("Home Page Error:", error);
        // Fallback render in case database fails
        res.render("user/home", { title: "Bella Beauty", isLoggedIn: false, categories: [], featuredProducts: [] });
    }
};