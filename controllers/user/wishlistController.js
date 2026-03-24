import { toggleWishlistItem, getWishlistData, removeWishlistItem } from "../../services/userServices/wishlistService.js";
import { addItemToCart } from "../../services/userServices/cartService.js";

// ==========================================
// 1. RENDER WISHLIST PAGE
// ==========================================
// This loads the actual Wishlist webpage. It grabs the user's ID, 
// fetches all their saved items from the database, and sends that 
// data to the EJS template to be displayed.
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
        console.error("Wishlist Page Error:", error);
        res.redirect("/shop");
    }
};

// ==========================================
// 2. TOGGLE HEART BUTTON (AJAX)
// ==========================================
// This runs in the background when a user clicks a heart icon. 
// It checks if the item is already saved: if yes, it removes it; 
// if no, it adds it. Then it sends a JSON response back to the browser.
export const toggleWishlistAjax = async (req, res) => {
    try {
        const { variantId } = req.body;
        const result = await toggleWishlistItem(req.session.userId, variantId);
        res.json({ success: true, isAdded: result.isAdded });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ==========================================
// 3. MOVE TO CART BUTTON (AJAX)
// ==========================================
// This runs when a user clicks the cart icon inside their wishlist.
// It performs two database actions at once: it adds the item to their cart,
// and immediately deletes it from their wishlist so there are no duplicates.
export const moveToCartAjax = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { variantId } = req.body;

        const cart = await addItemToCart(userId, variantId, 1);
        await removeWishlistItem(userId, variantId);

        res.json({ success: true, message: "Moved to Cart!", cartCount: cart.items.length });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};