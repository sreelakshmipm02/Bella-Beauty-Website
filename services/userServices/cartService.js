import Cart from "../../models/cart.js";
import ProductVariant from "../../models/productVariant.js";
import Product from "../../models/product.js";
import Category from "../../models/category.js";

const MAX_QTY_PER_ITEM = 5;
const GST_RATE = 0.18; // 18% GST (You can adjust this)

// --- Helper: Calculate Cart Totals ---
const calculateCartTotals = (items) => {
    let subtotal = 0;

    items.forEach(item => {
        if (!item.outOfStock && variantIsActive(item.variant)) {
            subtotal += (item.variant.price * item.quantity);
        }
    });

    // Assuming the item price INCLUDES GST. We extract the tax amount.
    const preTaxAmount = subtotal / (1 + GST_RATE);
    const taxAmount = subtotal - preTaxAmount;

    return {
        subtotal: preTaxAmount.toFixed(2),
        tax: taxAmount.toFixed(2),
        total: subtotal.toFixed(2), // Final price user pays
        totalItems: items.length
    };
};

// Updated Helper to include Category check
const variantIsActive = async (variant) => {
    // 1. Basic existence and status checks
    if (!variant || variant.status !== 'active') return false;

    // 2. Product checks
    const product = await Product.findById(variant.productId).populate('categoryId');
    if (!product || product.status !== 'active') return false;

    // 3. Category checks (The missing piece)
    const category = product.categoryId;
    if (!category || category.isListed === false) return false;

    return true;
};

// ==========================================
// 1. ADD ITEM TO CART 
// ==========================================
export const addItemToCart = async (userId, variantId, quantity = 1) => {
    const variant = await ProductVariant.findById(variantId).populate('productId');

    if (!variantIsActive(variant)) throw new Error("This product is currently unavailable.");
    if (variant.stock <= 0) throw new Error("This item is out of stock.");
    if (quantity > variant.stock) throw new Error(`Only ${variant.stock} left in stock.`);
    if (quantity > MAX_QTY_PER_ITEM) throw new Error(`Maximum limit is ${MAX_QTY_PER_ITEM} per item.`);

    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    const existingItemIndex = cart.items.findIndex(item => item.productVariantId.toString() === variantId.toString());

    if (existingItemIndex > -1) {
        const newQty = cart.items[existingItemIndex].quantity + quantity;
        if (newQty > variant.stock) throw new Error(`Cannot add more. Only ${variant.stock} left.`);
        if (newQty > MAX_QTY_PER_ITEM) throw new Error(`Limit of ${MAX_QTY_PER_ITEM} reached.`);
        cart.items[existingItemIndex].quantity = newQty;
    } else {
        cart.items.push({ productVariantId: variantId, quantity });
    }

    await cart.save();
    return cart;
};

// ==========================================
// 2. GET CART DATA (With Auto-Correction)
// ==========================================
export const getCartData = async (userId) => {
    // 1. Fetch and populate. We must include categoryId for the check.
    const cart = await Cart.findOne({ userId }).populate({
        path: 'items.productVariantId',
        populate: {
            path: 'productId',
            populate: { path: 'categoryId' } // Deep populate category
        }
    });

    if (!cart || !cart.items || cart.items.length === 0) {
        return { items: [], summary: { subtotal: 0, tax: 0, total: 0, totalItems: 0 } };
    }

    let formattedItems = [];
    let cartModified = false;

    for (let item of cart.items) {
        const variant = item.productVariantId;
        const product = variant?.productId;
        const category = product?.categoryId;

        // --- THE "KEEP" CONDITIONS ---
        // We only keep the item if ALL of these are true:
        const isProductActive = product && product.status === 'active';
        const isVariantActive = variant && variant.status === 'active';
        const isCategoryActive = category && category.status !== 'inactive';
        const hasStock = variant && variant.stock > 0;

        if (isProductActive && isVariantActive && isCategoryActive && hasStock) {
            let actualQty = item.quantity;

            // Auto-adjust quantity if it exceeds available stock
            if (actualQty > variant.stock) {
                actualQty = variant.stock;
                item.quantity = actualQty;
                cartModified = true;
            }

            formattedItems.push({
                itemId: item._id,
                variantId: variant._id,
                productName: product.name,
                brand: product.brand,
                slug: product.slug,
                image: variant.images ? variant.images[0] : null,
                price: variant.price,
                quantity: actualQty,
                stock: variant.stock,
                attributes: variant.attributes,
                itemTotal: (variant.price * actualQty).toFixed(2),
                outOfStock: false,
                variant: variant
            });
        } else {
            // If ANY condition failed (Category inactive, Product inactive, or 0 Stock)
            // We do NOT push to formattedItems, and we mark the cart for cleaning
            cartModified = true;
        }
    }

    // STEP 2: The Sync Logic (Deletes the items from MongoDB)
    if (cartModified) {
        const activeVariantIds = formattedItems.map(f => f.variantId.toString());

        cart.items = cart.items.filter(item => {
            if (!item.productVariantId) return false;
            // Get ID regardless of whether it is populated or just an ID string
            const currentId = item.productVariantId._id
                ? item.productVariantId._id.toString()
                : item.productVariantId.toString();

            return activeVariantIds.includes(currentId);
        });

        await cart.save();
    }

    return {
        items: formattedItems.reverse(),
        summary: calculateCartTotals(formattedItems)
    };
};
// ==========================================
// 3. UPDATE QUANTITY (AJAX)
// ==========================================
export const updateItemQuantity = async (userId, variantId, newQuantity) => {
    const variant = await ProductVariant.findById(variantId);

    if (!variant || variant.status !== 'active') throw new Error("Item unavailable.");
    if (newQuantity > variant.stock) throw new Error(`Only ${variant.stock} left in stock.`);
    if (newQuantity > MAX_QTY_PER_ITEM) throw new Error(`Limit is ${MAX_QTY_PER_ITEM}.`);
    if (newQuantity < 1) throw new Error("Quantity cannot be less than 1.");

    const cart = await Cart.findOne({ userId });
    const itemIndex = cart.items.findIndex(item => item.productVariantId.toString() === variantId.toString());

    if (itemIndex === -1) throw new Error("Item not found in cart.");

    cart.items[itemIndex].quantity = newQuantity;
    await cart.save();

    // Return fresh data for the frontend to update instantly
    return await getCartData(userId);
};

// ==========================================
// 4. REMOVE ITEM (AJAX)
// ==========================================
export const removeCartItem = async (userId, variantId) => {
    const cart = await Cart.findOne({ userId });
    if (!cart) return;

    cart.items = cart.items.filter(item => item.productVariantId.toString() !== variantId.toString());
    await cart.save();

    return await getCartData(userId);
};

// ==========================================
// 5. GET CART VARIANT IDs (For UI State)
// ==========================================
export const getUserCartVariantIds = async (userId) => {
    if (!userId) return [];

    // Model is safely kept only in the service file!
    const cart = await Cart.findOne({ userId });
    if (!cart) return [];

    // Return an array of string IDs (e.g., ['65abc123...', '65def456...'])
    return cart.items.map(item => item.productVariantId.toString());
};

export const validateCartAvailability = async (userId) => {
    // 1. Fetch cart
    const cart = await Cart.findOne({ userId }).populate('items.productVariantId');

    if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error("Your cart is empty.");
    }

    for (const item of cart.items) {
        const variant = item.productVariantId;

        // If the variant was deleted from DB
        if (!variant) {
            throw new Error("An item in your cart is no longer available.");
        }

        // 2. Fetch Product and its Category explicitly
        const product = await Product.findById(variant.productId).populate('categoryId');

        if (!product) {
            throw new Error("A product in your cart has been removed.");
        }

        const category = product.categoryId;

        // --- THE HIERARCHY OF DEACTIVATION ---

        // A. Check Category Status
        if (!category || category.status === 'inactive') {
            throw new Error(`The "${category ? category.name : 'selected'}" category has been deactivated. Please remove items from this category to proceed.`);
        }

        // B. Check Product Status
        if (product.status !== 'active') {
            throw new Error(`"${product.name}" is currently unavailable.`);
        }

        // C. Check Variant Status
        if (variant.status !== 'active') {
            throw new Error(`A specific version of "${product.name}" is no longer available.`);
        }

        // D. Check Stock
        if (variant.stock <= 0) {
            throw new Error(`"${product.name}" just went out of stock.`);
        }
    }
    return true;
};