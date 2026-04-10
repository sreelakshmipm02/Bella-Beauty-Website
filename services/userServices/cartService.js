import Cart from "../../models/cart.js";
import ProductVariant from "../../models/productVariant.js";
import Product from "../../models/product.js";
import Category from "../../models/category.js";

// Global shopping constraints
const MAX_QTY_PER_ITEM = 5;
const GST_RATE = 0.18; // 18% Tax

// ---------------------------------------------------------
//  HELPERS: TOTALS & VALIDATION
// ---------------------------------------------------------

/**
 * Calculates the final price, tax, and item count.
 * Includes dynamic shipping cost calculation (Free over ₹500).
 */
const calculateCartTotals = (items) => {
    let subtotal = 0;

    items.forEach(item => {
        if (!item.outOfStock) {
            subtotal += (item.price * item.quantity);
        }
    });

    const preTaxAmount = subtotal / (1 + GST_RATE);
    const taxAmount = subtotal - preTaxAmount;

    // --- NEW: Dynamic Shipping Logic ---
    const FREE_SHIPPING_THRESHOLD = 500;
    const STANDARD_DELIVERY_CHARGE = 40; // Change this to your preferred delivery fee

    // If subtotal is 0 (empty cart), shipping is 0. Otherwise apply threshold logic.
    let shippingCost = 0;
    if (subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD) {
        shippingCost = STANDARD_DELIVERY_CHARGE;
    }

    // Add shipping cost to the final total
    const finalTotal = subtotal + shippingCost;

    return {
        subtotal: preTaxAmount.toFixed(2),
        tax: taxAmount.toFixed(2),
        shipping: shippingCost, // Now available in the summary object
        total: finalTotal.toFixed(2),
        totalItems: items.length
    };
};
/**
 * Validates the "Life Chain" of a product.
 * Returns true only if Category, Product, and Variant are all active/listed.
 */
const variantIsActive = async (variant) => {
    if (!variant || variant.status !== 'active') return false;

    const product = await Product.findById(variant.productId).populate('categoryId');
    if (!product || product.status !== 'active') return false;

    const category = product.categoryId;
    if (!category || category.isListed === false) return false;

    return true;
};

// ---------------------------------------------------------
//  1. ADD ITEM TO CART 
// ---------------------------------------------------------

export const addItemToCart = async (userId, variantId, quantity = 1) => {
    const variant = await ProductVariant.findById(variantId).populate('productId');

    // Business rule checks
    if (!await variantIsActive(variant)) throw new Error("This product is currently unavailable.");
    if (variant.stock <= 0) throw new Error("This item is out of stock.");
    if (quantity > variant.stock) throw new Error(`Only ${variant.stock} left in stock.`);
    if (quantity > MAX_QTY_PER_ITEM) throw new Error(`Maximum limit is ${MAX_QTY_PER_ITEM} per item.`);

    let cart = await Cart.findOne({ userId });
    if (!cart) cart = new Cart({ userId, items: [] });

    const existingItemIndex = cart.items.findIndex(item => item.productVariantId.toString() === variantId.toString());

    if (existingItemIndex > -1) {
        // Increment quantity if item already exists in cart
        const newQty = cart.items[existingItemIndex].quantity + quantity;
        if (newQty > variant.stock) throw new Error(`Cannot add more. Only ${variant.stock} left.`);
        if (newQty > MAX_QTY_PER_ITEM) throw new Error(`Limit of ${MAX_QTY_PER_ITEM} reached.`);
        cart.items[existingItemIndex].quantity = newQty;
    } else {
        // Add new entry to the items array
        cart.items.push({ productVariantId: variantId, quantity });
    }

    await cart.save();
    return cart;
};

// ---------------------------------------------------------
//  2. DATA RETRIEVAL (With Auto-Sync/Healing)
// ---------------------------------------------------------

export const getCartData = async (userId) => {
    // We deep populate to check the status of everything in the product's hierarchy
    const cart = await Cart.findOne({ userId }).populate({
        path: 'items.productVariantId',
        populate: {
            path: 'productId',
            populate: { path: 'categoryId' }
        }
    });

    if (!cart || !cart.items || cart.items.length === 0) {
        return { items: [], summary: { subtotal: 0, tax: 0, total: 0, totalItems: 0 }, adjustments: [] };
    }

    let formattedItems = [];
    let adjustments = [];
    let cartModified = false;

    for (let item of cart.items) {
        const variant = item.productVariantId;
        const product = variant?.productId;
        const category = product?.categoryId;

        // Validity Flags
        const isProductActive = product && product.status === 'active';
        const isVariantActive = variant && variant.status === 'active';
        const isCategoryActive = category && category.status !== 'inactive';
        const hasStock = variant && variant.stock > 0;

        if (isProductActive && isVariantActive && isCategoryActive && hasStock) {
            let actualQty = item.quantity;

            // Auto-correct if user's quantity exceeds current warehouse stock
            if (actualQty > variant.stock) {
                actualQty = variant.stock;
                item.quantity = actualQty;
                adjustments.push(`${product.name} reduced from ${item.quantity} to ${variant.stock} (Limited Stock)`);
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
                variant: variant // Kept for sub-logic in total calculation
            });
        } else if (product) {
            // Item is now unavailable or out of stock
            adjustments.push(`${product.name} removed (No longer available)`);
            cartModified = true;
        }
    }

    // Database Cleaning: Remove any items that failed the "active" check
    if (cartModified) {
        const activeVariantIds = formattedItems.map(f => f.variantId.toString());

        cart.items = cart.items.filter(item => {
            if (!item.productVariantId) return false;
            const currentId = item.productVariantId._id
                ? item.productVariantId._id.toString()
                : item.productVariantId.toString();

            return activeVariantIds.includes(currentId);
        });

        await cart.save();
    }

    return {
        items: formattedItems.reverse(), // Newest items first
        summary: calculateCartTotals(formattedItems),
        adjustments
    };
};

// ---------------------------------------------------------
//  3. QUANTITY & REMOVAL ACTIONS
// ---------------------------------------------------------

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

    return await getCartData(userId);
};

export const removeCartItem = async (userId, variantId) => {
    const cart = await Cart.findOne({ userId });
    if (!cart) return;

    cart.items = cart.items.filter(item => item.productVariantId.toString() !== variantId.toString());
    await cart.save();

    return await getCartData(userId);
};

// ---------------------------------------------------------
//  4. UI STATE UTILITIES
// ---------------------------------------------------------

/**
 * Returns an array of variant IDs in the cart.
 * Essential for highlighting "In Cart" items on the shop page.
 */
export const getUserCartVariantIds = async (userId) => {
    if (!userId) return [];
    const cart = await Cart.findOne({ userId });
    if (!cart) return [];
    return cart.items.map(item => item.productVariantId.toString());
};

// ---------------------------------------------------------
//  5. PRE-CHECKOUT GATEKEEPER
// ---------------------------------------------------------

/**
 * Final manual check before proceeding to checkout.
 * Provides specific error messages for Category/Product/Variant deactivation.
 */
export const validateCartAvailability = async (userId) => {
    // Populate the variant so we can check stock and status
    const cart = await Cart.findOne({ userId }).populate('items.productVariantId');

    if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error("Your cart is empty.");
    }

    let errors = []; // Array to collect all issues point-wise

    for (const item of cart.items) {
        const variant = item.productVariantId;

        // 1. Check if the variant still exists in the DB
        if (!variant) {
            errors.push("An item in your cart is no longer available.");
            continue; // Skip further checks for this specific item
        }

        const product = await Product.findById(variant.productId).populate('categoryId');

        // 2. Check if the product or category still exists/is active
        if (!product) {
            errors.push("A product in your cart has been removed.");
            continue;
        }

        const category = product.categoryId;

        // 3. Hierarchy of status and stock checks
        if (!category || category.status === 'inactive') {
            errors.push(`The "${category ? category.name : 'selected'}" category is currently deactivated.`);
        }
        else if (product.status !== 'active') {
            errors.push(`"${product.name}" is no longer available for purchase.`);
        }
        else if (variant.status !== 'active') {
            errors.push(`The specific variant of "${product.name}" you selected is unavailable.`);
        }
        // Check for complete stock depletion
        else if (variant.stock <= 0) {
            errors.push(`"${product.name}" just went out of stock.`);
        }
        // Check for partial stock decrease (e.g., cart has 5, DB has 3)
        else if (item.quantity > variant.stock) {
            errors.push(`Stock for "${product.name}" decreased. Only ${variant.stock} units available.`);
        }
    }

    // If any errors were collected, throw them as a single string joined by a separator
    if (errors.length > 0) {
        // We use '|' as a separator so the controller can split it into a list
        throw new Error(errors.join('|'));
    }

    return true;
};