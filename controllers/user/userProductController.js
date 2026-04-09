import {
    getShopData,
    getActiveCategories,
    getActiveBrands,
    getActiveProductTypes,
    getProductBySlug,
    getCategoryById,
    getActiveVariants,
    getAttributesByIds,
    getRelatedProducts
} from "../../services/userServices/productService.js";

import { getUserCartVariantIds } from "../../services/userServices/cartService.js";

import { getUserWishlistVariantIds } from "../../services/userServices/wishlistService.js";

// Serves as the brain for the main "Shop All" page.
// This controller gathers the user's search terms, filters, and page numbers, 
// then asks the service layer to crunch the numbers. It hands all that data back 
// to the EJS template so the frontend can build the product grid and populate the filter sidebar.
export const getShopPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        // Fetch the filtered products, plus the lists of categories and brands needed for the sidebar dropdowns
        const { products, totalProducts } = await getShopData(req.query, skip, limit);
        const categories = await getActiveCategories();
        const brands = await getActiveBrands();
        const productTypes = await getActiveProductTypes();

        const totalPages = Math.ceil(totalProducts / limit);

        res.render("user/shop", {
            title: "Shop - Bella Beauty",
            isLoggedIn: !!req.session.userId,
            products,
            categories,
            brands,
            productTypes,
            currentPage: page,
            totalPages,
            totalProducts,
            // We pass the raw query object back to the frontend so the UI can "remember" 
            // what the user searched for and keep those checkboxes/inputs filled in.
            query: req.query
        });

    } catch (error) {
        console.error("Shop Page Error:", error);
        res.redirect("/");
    }
};

// Constructs the Product Detail Page (PDP) when a customer clicks on a specific item.
// This function includes several strict safety checks to ensure a user can never 
// view or buy a product that has been disabled, deleted, or stripped of its variants by an admin.
export const getProductDetails = async (req, res) => {
    try {
        const slug = req.params.slug;
        console.log("--- DETECTIVE LOGS ---");
        console.log("1. URL Slug Requested:", slug);

        const product = await getProductBySlug(slug);
        console.log("2. Did database find product?:", product ? "YES - " + product.name : "NO");

        // Safety Check 1: Does the product exist and is it active?
        if (!product || product.status !== 'active') {
            console.log("❌ Redirecting: Product is missing or not active.");
            return res.redirect('/shop');
        }

        const category = await getCategoryById(product.categoryId);

        // Safety Check 2: Even if the product is active, is its parent category active?
        // (If an admin disables the "Skincare" category, all skincare products should instantly hide)
        if (!category || category.status !== 'active') {
            console.log("❌ Redirecting: Category is missing or not active.");
            return res.redirect('/shop');
        }

        const variants = await getActiveVariants(product._id);
        console.log("3. Active Variants Found:", variants.length);

        // Safety Check 3: Does the product actually have things to sell?
        if (!variants || variants.length === 0) {
            console.log("❌ Redirecting: Product has 0 active variants.");
            return res.redirect('/shop');
        }

        // Fetch items already in cart AND wishlist so the buttons know their state!
        let cartVariantIds = [];
        let wishlistVariantIds = [];
        if (req.session.userId) {
            cartVariantIds = await getUserCartVariantIds(req.session.userId);
            wishlistVariantIds = await getUserWishlistVariantIds(req.session.userId);
        }

        // We extract all the unique attribute IDs from the variants (like Size, Color)
        // so we can fetch their display names from the database for the frontend buttons.
        const attributeIds = [...new Set(variants.flatMap(v => v.attributes.map(a => a.attributeId)))];
        const attributesInfo = await getAttributesByIds(attributeIds);

        // Grab a few other active products from the same category to show in the "You May Also Like" section.
        const relatedProducts = await getRelatedProducts(category._id, product._id, 4);

        console.log("✅ Success! Loading Product Page...");
        res.render("user/productDetail", {
            title: `${product.name} - Bella Beauty`,
            isLoggedIn: !!req.session.userId,
            product,
            category,
            variants,
            attributesInfo,
            // We stringify the variants array so the frontend JavaScript can safely read it 
            // to dynamically swap images, prices, and stock statuses when the user clicks different options.
            variantsJSON: JSON.stringify(variants),
            cartVariantIdsJSON: JSON.stringify(cartVariantIds),
            wishlistVariantIdsJSON: JSON.stringify(wishlistVariantIds),
            relatedProducts
        });

    } catch (error) {
        console.error("❌ Catch Block Error:", error);
        res.redirect("/shop");
    }
};