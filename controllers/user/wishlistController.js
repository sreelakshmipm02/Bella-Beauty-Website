import { toggleWishlistItem, getWishlistData, removeWishlistItem } from "../../services/userServices/wishlistService.js";
import { addItemToCart } from "../../services/userServices/cartService.js";

// ---------------------------------------------------------
//  1. VIEW RENDERING
// ---------------------------------------------------------

/**
 * Renders the user's personal wishlist page.
 * Fetches all saved product variants to display them in the EJS template.
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
        // If the database fetch fails, we send the user back to the shop to avoid a broken page
        console.error("Wishlist Page Error:", error);
        res.redirect("/shop");
    }
};

// ---------------------------------------------------------
//  2. WISHLIST ACTIONS (AJAX)
// ---------------------------------------------------------

/**
 * AJAX: Handles the 'Heart' icon functionality.
 * This is a "toggle" action: it adds the item if it’s missing, or removes it if it’s present.
 * The 'isAdded' flag tells the frontend whether to fill or outline the heart icon.
 */
export const toggleWishlistAjax = async (req, res) => {
    try {
        const { variantId } = req.body;
        
        // The service returns whether the final state was 'added' or 'removed'
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
 * AJAX: Transfers an item from the Wishlist to the Shopping Cart.
 * This involves two sequential operations: adding to the cart first, 
 * then purging it from the wishlist to keep the list clean.
 */
export const moveToCartAjax = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { variantId } = req.body;

        // 1. Add to cart with a default quantity of 1
        const cart = await addItemToCart(userId, variantId, 1);
        
        // 2. Remove the item from wishlist since it's now an active cart item
        await removeWishlistItem(userId, variantId);

        res.json({ 
            success: true, 
            message: "Item moved to cart successfully!", 
            cartCount: cart.items.length 
        });
    } catch (error) {
        // If the item is out of stock, the cart service will throw an error here
        res.status(400).json({ 
            success: false, 
            message: error.message || "Failed to move item to cart." 
        });
    }
};