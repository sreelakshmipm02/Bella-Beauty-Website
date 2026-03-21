import Cart from "../../models/cart.js";
import ProductVariant from "../../models/productVariant.js";

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

// Helper to check if item is fully active
const variantIsActive = (variant) => {
    return variant && variant.status === 'active' && variant.productId && variant.productId.status === 'active';
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
    const cart = await Cart.findOne({ userId }).populate({
        path: 'items.productVariantId',
        populate: { path: 'productId' }
    });

    if (!cart || cart.items.length === 0) return { items: [], summary: { subtotal: 0, tax: 0, total: 0, totalItems: 0 } };

    let formattedItems = [];
    let cartModified = false;

    // Loop through items and auto-correct stock issues silently
    for (let item of cart.items) {
        const variant = item.productVariantId;
        
        if (variantIsActive(variant)) {
            let actualQty = item.quantity;
            let outOfStock = false;

            if (variant.stock === 0) {
                outOfStock = true;
            } else if (actualQty > variant.stock) {
                actualQty = variant.stock; // Auto-reduce to max available
                item.quantity = actualQty;
                cartModified = true;
            }

            formattedItems.push({
                itemId: item._id,
                variantId: variant._id,
                productName: variant.productId.name,
                brand: variant.productId.brand,
                slug: variant.productId.slug,
                image: variant.images[0],
                price: variant.price,
                quantity: actualQty,
                stock: variant.stock,
                attributes: variant.attributes,
                itemTotal: (variant.price * actualQty).toFixed(2),
                outOfStock: outOfStock,
                variant: variant // Pass full variant for total calculation
            });
        } else {
            // Remove deactivated items from cart
            cart.items = cart.items.filter(i => i._id.toString() !== item._id.toString());
            cartModified = true;
        }
    }

    if (cartModified) await cart.save();

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