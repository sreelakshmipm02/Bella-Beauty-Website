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
            description: finalDescription,
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

// ==========================================
// GET EDIT PRODUCT PAGE
// ==========================================
export const getEditProductPage = async (req, res) => {
    try {
        const productId = req.params.id;

        // 1. Fetch the base product
        const product = await Product.findById(productId);
        if (!product) {
            // If someone types a random ID in the URL, kick them back to the list
            return res.redirect('/admin/products');
        }

        // 2. Fetch all variants belonging to this product
        const variants = await ProductVariant.find({ productId: product._id });

        // 3. Fetch all active categories for the dropdown menu
        const categories = await Category.find({ status: 'active' }).sort({ name: 1 });

        // 4. Render the page, passing all this data to the frontend
        res.render("admin/editProduct", {
            title: "Edit Product",
            product,
            variants, // We pass the variants array so our JS can load them
            categories
        });

    } catch (error) {
        console.error("Error loading edit product page:", error);
        res.redirect("/admin/products");
    }
};

// ==========================================
// UPDATE EXISTING PRODUCT (PUT)
// ==========================================
export const updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, brand, description, variantsJSON } = req.body;

        // 1. Update the Base Product
        // We set description to undefined if it's empty so Mongoose doesn't complain
        const finalDescription = description.trim() === '' ? undefined : description;

        await Product.findByIdAndUpdate(productId, {
            name,
            brand,
            description: finalDescription
        });

        // 2. Parse the incoming variants array from the frontend
        const variantsData = JSON.parse(variantsJSON);

        // Track which variants are kept so we can delete the ones the admin removed
        const activeVariantIds = [];

        // 3. Process Each Variant
        for (let i = 0; i < variantsData.length; i++) {
            const variant = variantsData[i];

            // Start with any existing images this variant already had
            let finalImages = variant.images || [];

            // --- CLOUDINARY UPLOAD LOGIC ---
            if (req.files) {
                const newFilesForVariant = req.files.filter(f => f.fieldname === `variant_images_${i}`);

                if (newFilesForVariant.length > 0) {
                    // DEBUG: Log the first file object to the terminal so we can see what Cloudinary returns
                    console.log("Cloudinary File Data:", newFilesForVariant[0]);

                    // Extract the URLs using multiple fallbacks so we never get 'undefined'
                    const newImageUrls = newFilesForVariant.map(file => {
                        return file.path || file.secure_url || file.url;
                    });

                    // Filter out any undefined junk just in case, before giving it to Mongoose
                    const validUrls = newImageUrls.filter(url => url != null);
                    finalImages.push(...validUrls);
                }
            }

            // SAFETY GATE: Prevent the server from crashing if Cloudinary fails!
            if (finalImages.length < 3) {
                console.error(`Variant ${variant.sku || i} is missing images. Found:`, finalImages);
                return res.status(400).json({
                    success: false,
                    message: `Cannot save. Variant ${variant.sku || i} requires at least 3 images, but Cloudinary failed to return the URLs.`
                });
            }
            // --- UPDATE OR CREATE VARIANT ---
            if (variant._id) {
                // If the variant has an _id, it already existed. Update it!
                await ProductVariant.findByIdAndUpdate(variant._id, {
                    sku: variant.sku,
                    price: variant.price,
                    stock: variant.stock,
                    attributes: variant.attributes,
                    images: finalImages
                });
                activeVariantIds.push(variant._id); // Mark as kept
            } else {
                // If it doesn't have an _id, it's a brand new variant added during editing!
                const newVariant = await ProductVariant.create({
                    productId: productId,
                    sku: variant.sku,
                    price: variant.price,
                    stock: variant.stock,
                    attributes: variant.attributes,
                    images: finalImages
                });
                activeVariantIds.push(newVariant._id); // Mark as kept
            }
        }

        // 4. Cleanup: Delete any variants from the database that the admin removed from the UI queue
        await ProductVariant.deleteMany({
            productId: productId,
            _id: { $nin: activeVariantIds } // Delete where _id is NOT IN our active list
        });

        // 5. Send Success back to frontend JavaScript
        res.status(200).json({ success: true, message: 'Product updated successfully' });

    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ success: false, message: "Internal server error while updating product." });
    }
};