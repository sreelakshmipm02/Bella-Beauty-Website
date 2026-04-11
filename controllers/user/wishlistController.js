import { toggleWishlistItem, getWishlistData, removeWishlistItem } from "../../services/userServices/wishlistService.js";
import { addItemToCart } from "../../services/userServices/cartService.js";

// ---------------------------------------------------------
//  1. WISHLIST PAGE
// ---------------------------------------------------------

/**
 * Show user's wishlist items.
 */
export const getWishlistPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        const wishlistItems = await getWishlistData(userId);

        res.render("user/wishlist", {
            title: "My Wishlist - Bella Beauty",
            isLoggedIn: true,
            wishlistItems
        });
    } catch (error) {
        // If something goes wrong, redirect safely
        console.error("Wishlist Page Error:", error);
        res.redirect("/shop");
    }
};

// ---------------------------------------------------------
//  2. WISHLIST ACTIONS (AJAX)
// ---------------------------------------------------------

/**
 * Add or remove item from wishlist (toggle).
 */
export const toggleWishlistAjax = async (req, res) => {
    try {
        const { variantId } = req.body;
        
        // Toggle item (add/remove)
        const result = await toggleWishlistItem(req.session.userId, variantId);
        
        res.json({ 
            success: true, 
            isAdded: result.isAdded 
        });
    } catch (error) {
        res.status(400).json({ 
            success: false, 
            message: error.message || "Could not update wishlist." 
        });
    }
};

/**
 * Move item from wishlist to cart.
 */
export const moveToCartAjax = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { variantId } = req.body;

        // Add item to cart
        const cart = await addItemToCart(userId, variantId, 1);
        
        // Remove from wishlist
        await removeWishlistItem(userId, variantId);

        res.json({ 
            success: true, 
            message: "Item moved to cart successfully!", 
            cartCount: cart.items.length 
        });
    } catch (error) {
        // Handle errors (like out of stock)
        res.status(400).json({ 
            success: false, 
            message: error.message || "Failed to move item to cart." 
        });
    }
};