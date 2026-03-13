import {
    getAdminProductsList,
    getActiveCategories,
    toggleProductStatusById,
    createNewProduct,
    getProductDataForEdit,
    updateExistingProduct
} from "../../services/adminServices/productService.js";

// Loads the main product dashboard.
// We pass pagination, search, and filter queries straight to the service layer.
// Returning the queries back to the view (like searchQuery and currentCategory) 
// ensures the admin's filter selections stay active on the screen after the page reloads.
export const getProductsPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5; 
        const { search, category, status } = req.query;

        const { products, totalProducts } = await getAdminProductsList(page, limit, search, category, status);
        const categories = await getActiveCategories();
        
        const totalPages = Math.ceil(totalProducts / limit);

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

// Acts as a soft-delete toggle. 
// We never permanently delete products because old customer orders rely on that data.
// This endpoint returns a simple JSON response so the frontend can instantly update the UI (like a SweetAlert) without a full page refresh.
export const toggleProductStatus = async (req, res) => {
    try {
        const newStatus = await toggleProductStatusById(req.params.id);
        res.json({ success: true, message: `Product is now ${newStatus}.` });
    } catch (error) {
        console.error("Error toggling product status:", error);
        res.status(error.message === "Product not found" ? 404 : 500)
           .json({ success: false, message: error.message || "Server error." });
    }
};

// Prepares the "Add Product" form.
// We only fetch 'active' categories here because we don't want admins creating new products in categories that are currently hidden or disabled.
export const getAddProductPage = async (req, res) => {
    try {
        const categories = await getActiveCategories();
        res.render("admin/addProduct", { title: "Add New Product", categories });
    } catch (error) {
        console.error("Error loading add product page:", error);
        res.redirect("/admin/products");
    }
};

// Catches the massive multipart/form-data payload when an admin saves a new product.
// Because HTML forms can't send complex nested arrays natively, the frontend stringifies the variants data.
// We parse it back into a JavaScript array here, then hand everything off to the service layer to process the database saves and image links.
export const createProduct = async (req, res) => {
    try {
        const variantsData = JSON.parse(req.body.variantsJSON);
        
        await createNewProduct(req.body, variantsData, req.files);

        res.status(201).json({ success: true, message: "Product and variants created successfully!" });
    } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ success: false, message: "Server error while saving product data.", error: error.message });
    }
};

// Feeds the "Edit Product" interface.
// We pull the base product data AND all its associated variants so the frontend JavaScript 
// can rebuild the exact state of the product, including pre-checking dynamic attribute boxes.
export const getEditProductPage = async (req, res) => {
    try {
        const { product, variants } = await getProductDataForEdit(req.params.id);
        const categories = await getActiveCategories();

        res.render("admin/editProduct", {
            title: "Edit Product",
            product,
            variants, 
            categories
        });
    } catch (error) {
        console.error("Error loading edit product page:", error);
        res.redirect("/admin/products");
    }
};

// Processes the final save when editing an existing product.
// Just like creation, we parse the stringified variants array. 
// The real magic happens in the service layer, which figures out which variants were updated, which were added, and which were deleted.
export const updateProduct = async (req, res) => {
    try {
        const variantsData = JSON.parse(req.body.variantsJSON);

        await updateExistingProduct(req.params.id, req.body, variantsData, req.files);

        res.status(200).json({ success: true, message: 'Product updated successfully' });
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(400).json({ success: false, message: error.message || "Internal server error while updating product." });
    }
};