import { addItemToCart, getCartData, updateItemQuantity, removeCartItem } from "../../services/userServices/cartService.js";
import { addToWishlistSafe } from "../../services/userServices/wishlistService.js";

export const addToCart = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { variantId, quantity } = req.body;

        // Pass the request to the service layer
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

// Render the Cart Page
export const getCartPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        const cartData = await getCartData(userId);
        const errorMsg = req.query.error === 'stock_issue' ? "Some items in your cart went out of stock. Please remove them to proceed." : null;

        res.render("user/cart", {
            title: "Your Shopping Cart - Bella Beauty",
            isLoggedIn: true,
            cart: cartData,
            errorMsg
        });
    } catch (error) {
        console.error("Cart Page Error:", error);
        res.redirect("/shop");
    }
};

// AJAX: Update Quantity
export const updateCartAjax = async (req, res) => {
    try {
        const { variantId, quantity } = req.body;
        const newCartData = await updateItemQuantity(req.session.userId, variantId, parseInt(quantity));

        res.json({ success: true, cart: newCartData });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// AJAX: Remove Item
export const removeFromCartAjax = async (req, res) => {
    try {
        const { variantId } = req.body;
        const newCartData = await removeCartItem(req.session.userId, variantId);

        res.json({ success: true, cart: newCartData });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const moveToWishlistAjax = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { variantId } = req.body;

        // 1. Add to Wishlist using our new Service
        await addToWishlistSafe(userId, variantId);

        // 2. Remove from Cart using the existing Service
        await removeCartItem(userId, variantId);
        
        // 3. Get fresh cart data to send back to the UI
        const updatedCart = await getCartData(userId);

        res.json({ success: true, message: "Moved to Wishlist", cart: updatedCart });
    } catch (error) {
        console.error("Move to Wishlist Error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};