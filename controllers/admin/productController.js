import Category from "../../models/category.js";
import Product from "../../models/product.js";
import ProductVariant from "../../models/productVariant.js";
import mongoose from "mongoose";


// Render the Main Product Listing Page
// Updated Get Products Page (Handles Search, Filters, and Pagination)
export const getProductsPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Products per page
        const skip = (page - 1) * limit;

        const { search, category, status } = req.query;

        // 1. Build the Match Query
        let matchQuery = {};

        // Search by name or brand
        if (search) {
            matchQuery.$or = [
                { name: { $regex: search, $options: 'i' } },
                { brand: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by Status
        if (status && status !== 'all') {
            matchQuery.status = status;
        }

        // Filter by Category
        if (category && category !== 'all') {
            matchQuery.categoryId = new mongoose.Types.ObjectId(category);
        }

        // Fetch categories for the dropdown filter
        const categories = await Category.find({ status: 'active' }).sort({ name: 1 });

        // Count total matching products for pagination
        const totalProducts = await Product.countDocuments(matchQuery);
        const totalPages = Math.ceil(totalProducts / limit);

        // 2. Aggregation Pipeline
        const products = await Product.aggregate([
            { $match: matchQuery },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: "categories", 
                    localField: "categoryId",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            {
                $unwind: {
                    path: "$categoryDetails",
                    preserveNullAndEmptyArrays: true // Prevents crash if category is deleted
                }
            },
            {
                $lookup: {
                    from: "productvariants",
                    localField: "_id",
                    foreignField: "productId",
                    as: "variants"
                }
            },
            {
                $addFields: {
                    totalStock: { $sum: "$variants.stock" }
                }
            }
        ]);

        res.render("admin/products", {
            title: "Product Management",
            products,
            categories,
            searchQuery: search || '',
            currentCategory: category || 'all',
            currentStatus: status || 'all',
            currentPage: page,
            totalPages,
            totalProducts,
            limit
        });

    } catch (error) {
        console.error("Error loading products page:", error);
        res.redirect("/admin/dashboard");
    }
};

// ==========================================
// Toggle Product Status (Soft Delete)
// ==========================================
export const toggleProductStatus = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Toggle logic
        product.status = product.status === 'active' ? 'inactive' : 'active';
        await product.save();

        res.json({ success: true, message: `Product is now ${product.status}.` });
    } catch (error) {
        console.error("Error toggling product status:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
};

// Render the main Add Product Page
export const getAddProductPage = async (req, res) => {
    try {
        // Fetch only active categories to populate the dropdown on the main page
        const categories = await Category.find({ status: 'active' }).sort({ name: 1 });

        res.render("admin/addProduct", {
            title: "Add New Product",
            categories
        });
    } catch (error) {
        console.error("Error loading add product page:", error);
        res.redirect("/admin/products");
    }
};

// ==========================================
// CREATE PRODUCT & VARIANTS (RESTful POST)
// ==========================================
export const createProduct = async (req, res) => {
    try {
        // 1. Extract the base product details and the stringified variants array
        const { name, brand, categoryId, description, variantsJSON } = req.body;

        // Create a URL-friendly slug (e.g., "Radiant Glow Serum" -> "radiant-glow-serum")
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

        // NEW: If the description is just empty space, set it to undefined so Mongoose ignores it entirely
        const finalDescription = description.trim() === '' ? undefined : description;
        // 2. Save the Base Product to the `products` collection
        const newProduct = new Product({
            name,
            brand,
            description : finalDescription,
            categoryId,
            slug,
            status: "active", // Or "inactive" if you want them hidden by default
            // createdBy: req.session.adminId // Uncomment if you are tracking which admin made it
        });
        
        const savedProduct = await newProduct.save();

        // 3. Parse the Variants JSON back into a JavaScript array
        const variants = JSON.parse(variantsJSON);

        // 4. Loop through each variant, attach its specific images, and save to `product_variants`
        for (let i = 0; i < variants.length; i++) {
            const variantData = variants[i];
            
            // Look through all uploaded files (req.files) and find the ones belonging to THIS variant index
            // Cloudinary stores the live URL in `file.path` or `file.secure_url`
            const variantImages = req.files
                .filter(file => file.fieldname === `variant_images_${i}`)
                .map(file => file.path || file.secure_url);

            const newVariant = new ProductVariant({
                productId: savedProduct._id, // Link back to the parent product
                sku: variantData.sku,
                price: variantData.price,
                stock: variantData.stock,
                attributes: variantData.attributes, // The dynamic attributes array
                images: variantImages, // The Cloudinary URLs
                // createdBy: req.session.adminId // Uncomment if tracking admins
            });
            
            await newVariant.save();
        }

        // 5. Success!
        res.status(201).json({ 
            success: true, 
            message: "Product and variants created successfully!" 
        });

    } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error while saving product data.",
            error: error.message 
        });
    }
};