import {
    addItemToCart,
    getCartData,
    updateItemQuantity,
    removeCartItem,
    validateCartAvailability
} from "../../services/userServices/cartService.js";
import { addToWishlistSafe } from "../../services/userServices/wishlistService.js";

// ---------------------------------------------------------
//  1. CART CORE ACTIONS (Add, Update, Remove)
// ---------------------------------------------------------

/**
 * Handles adding a product variant to the user's cart.
 * Defaults to quantity 1 if not specified in the request.
 */
export const addToCart = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { variantId, quantity } = req.body;

        // Service layer handles stock validation and price calculations
        const cart = await addItemToCart(userId, variantId, parseInt(quantity) || 1);

        res.status(200).json({
            success: true,
            message: "Item added to cart successfully!",
            cartCount: cart.items.length
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * AJAX: Updates the quantity of a specific item already in the cart.
 * Returns the fresh cart data to update totals in the UI instantly.
 */
export const updateCartAjax = async (req, res) => {
    try {
        const { variantId, quantity } = req.body;
        const newCartData = await updateItemQuantity(req.session.userId, variantId, parseInt(quantity));

        res.json({ success: true, cart: newCartData });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * AJAX: Removes an item from the cart entirely.
 */
export const removeFromCartAjax = async (req, res) => {
    try {
        const { variantId } = req.body;
        const newCartData = await removeCartItem(req.session.userId, variantId);

        res.json({ success: true, cart: newCartData });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------
//  2. VIEW RENDERING
// ---------------------------------------------------------

/**
 * Renders the main shopping cart page.
 * Checks for a 'stock_issue' query param to show a friendly warning if 
 * items became unavailable while sitting in the cart.
 */
export const getCartPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        const cartData = await getCartData(userId);

        const errorMsg = req.query.error === 'stock_issue'
            ? "Some items in your cart went out of stock. Please remove them to proceed."
            : null;

        res.render("user/cart", {
            title: "Your Shopping Cart - Bella Beauty",
            isLoggedIn: true,
            cart: cartData,
            adjustments: cartData.adjustments || [],
            errorMsg
        });
    } catch (error) {
        console.error("Cart Page Error:", error);
        res.redirect("/shop");
    }
};

// ---------------------------------------------------------
//  3. CROSS-FEATURE LOGIC (Cart to Wishlist)
// ---------------------------------------------------------

/**
 * Moves an item from the cart to the wishlist.
 * Ensures the item is safely added to wishlist before removing it from the cart.
 */
// export const moveToWishlistAjax = async (req, res) => {
//     try {
//         const userId = req.session.userId;
//         const { variantId } = req.body;

//         // Save to wishlist, then purge from cart
//         await addToWishlistSafe(userId, variantId);
//         await removeCartItem(userId, variantId);

//         // Return latest cart state so the mini-cart or totals update
//         const updatedCart = await getCartData(userId);

//         res.json({ success: true, message: "Moved to Wishlist", cart: updatedCart });
//     } catch (error) {
//         console.error("Move to Wishlist Error:", error);
//         res.status(400).json({ success: false, message: error.message });
//     }
// };

// ---------------------------------------------------------
//  4. CHECKOUT VALIDATION
// ---------------------------------------------------------

/**
 * Pre-checkout gatekeeper.
 * Verifies that all items in the cart are still in stock and available 
 * before letting the user proceed to the checkout screen.
 */
export const verifyCheckoutAvailability = async (req, res) => {
    try {
        const userId = req.session.userId;

        // Perform final stock/availability check
        await validateCartAvailability(userId);

        // Sync totals one last time before the user sees the final bill
        await getCartData(userId);

        res.json({ success: true });
    } catch (error) {
        // Split the joined errors back into an array for the point-wise alert
        const errorList = error.message.split('|');
        // Returns specific errors like "Rice Water Sunscreen is no longer available"
        res.status(400).json({
            success: false,
            errors: errorList, // This must be an array for the frontend
            message: errorList[0]
        });
    }
};