import {
    addItemToCart,
    getCartData,
    updateItemQuantity,
    removeCartItem,
    validateCartAvailability
} from "../../services/userServices/cartService.js";
import { addToWishlistSafe } from "../../services/userServices/wishlistService.js";

// ---------------------------------------------------------
//  1. CART ACTIONS (Add, Update, Remove)
// ---------------------------------------------------------

/**
 * Add a product to the cart.
 * If quantity is not given, it will default to 1.
 */
export const addToCart = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { variantId, quantity } = req.body;

        // Add item using service (handles stock and price)
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
 * Update item quantity in cart using AJAX.
 * Returns updated cart data for UI changes.
 */
export const updateCartAjax = async (req, res) => {
    try {
        const { variantId, quantity } = req.body;

        const newCartData = await updateItemQuantity(
            req.session.userId,
            variantId,
            parseInt(quantity)
        );

        res.json({ success: true, cart: newCartData });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Remove an item from the cart using AJAX.
 */
export const removeFromCartAjax = async (req, res) => {
    try {
        const { variantId } = req.body;

        const newCartData = await removeCartItem(
            req.session.userId,
            variantId
        );

        res.json({ success: true, cart: newCartData });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------
//  2. CART PAGE
// ---------------------------------------------------------

/**
 * Show the cart page.
 * If there is a stock issue, display a warning message.
 */
export const getCartPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        const cartData = await getCartData(userId);

        const errorMsg = req.query.error === 'stock_issue'
            ? "Some items in your cart are out of stock. Please remove them to continue."
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
//  3. CART TO WISHLIST (OPTIONAL)
// ---------------------------------------------------------

/**
 * Move item from cart to wishlist.
 * First add to wishlist, then remove from cart.
 */
// export const moveToWishlistAjax = async (req, res) => {
//     try {
//         const userId = req.session.userId;
//         const { variantId } = req.body;

//         await addToWishlistSafe(userId, variantId);
//         await removeCartItem(userId, variantId);

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
 * Check if all items are still available before checkout.
 */
export const verifyCheckoutAvailability = async (req, res) => {
    try {
        const userId = req.session.userId;

        // Final stock check
        await validateCartAvailability(userId);

        // Refresh cart totals
        await getCartData(userId);

        res.json({ success: true });
    } catch (error) {
        // Convert error string into array for frontend
        const errorList = error.message.split('|');

        res.status(400).json({
            success: false,
            errors: errorList,
            message: errorList[0]
        });
    }
};