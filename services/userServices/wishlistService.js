import Wishlist from "../../models/wishlist.js";
import ProductVariant from "../../models/productVariant.js";

// ---------------------------------------------------------
//  1. WISHLIST CORE ACTIONS
// ---------------------------------------------------------

/**
 * Handles the "Heart" button logic. 
 * If the item exists, it's removed; if not, it's added. 
 * This prevents the need for two separate 'add' and 'remove' endpoints.
 */
export const toggleWishlistItem = async (userId, variantId) => {
    let wishlist = await Wishlist.findOne({ userId });
    
    if (!wishlist) {
        wishlist = new Wishlist({ userId, items: [] });
    }

    const itemIndex = wishlist.items.findIndex(
        item => item.productVariantId.toString() === variantId.toString()
    );
    
    let isAdded = false;

    if (itemIndex > -1) {
        // Item found: User wants to unlike/remove it
        wishlist.items.splice(itemIndex, 1); 
    } else {
        // Item not found: User wants to save it
        wishlist.items.push({ productVariantId: variantId });
        isAdded = true;
    }

    await wishlist.save();
    return { isAdded, totalItems: wishlist.items.length };
};

/**
 * A direct removal function.
 * Primarily used as a cleanup step when an item is moved from Wishlist to Cart.
 */
export const removeWishlistItem = async (userId, variantId) => {
    await Wishlist.updateOne(
        { userId },
        { $pull: { items: { productVariantId: variantId } } }
    );
};

/**
 * Saves an item to the wishlist only if it doesn't already exist.
 * Used during the "Move from Cart" flow to prevent duplicate entries.
 */
export const addToWishlistSafe = async (userId, variantId) => {
    let wishlist = await Wishlist.findOne({ userId });
    
    if (!wishlist) {
        wishlist = new Wishlist({ userId, items: [] });
    }

    const alreadyInWishlist = wishlist.items.some(
        item => item.productVariantId.toString() === variantId.toString()
    );
    
    if (!alreadyInWishlist) {
        wishlist.items.push({ productVariantId: variantId });
        await wishlist.save();
        return true; 
    }
    
    return false; // Already saved, no action needed
};

// ---------------------------------------------------------
//  2. DATA RETRIEVAL & SILENT CLEANUP
// ---------------------------------------------------------

/**
 * Fetches full product details for the wishlist page.
 * Includes a 'Self-Healing' loop that silently removes items from the user's 
 * wishlist if the admin has deactivated the product or the variant.
 */
export const getWishlistData = async (userId) => {
    const wishlist = await Wishlist.findOne({ userId }).populate({
        path: 'items.productVariantId',
        populate: { path: 'productId' }
    });

    if (!wishlist || wishlist.items.length === 0) return [];

    let formattedItems = [];
    let wishlistModified = false;

    for (let item of wishlist.items) {
        const variant = item.productVariantId;
        const product = variant?.productId;
        
        // Only show items where both the variant and the parent product are active
        if (variant && variant.status === 'active' && product && product.status === 'active') {
            formattedItems.push({
                variantId: variant._id,
                productName: product.name,
                brand: product.brand,
                slug: product.slug,
                image: variant.images[0],
                price: variant.price,
                stock: variant.stock,
                attributes: variant.attributes,
                addedAt: item.addedAt
            });
        } else {
            // Cleanup: The product is no longer "live", so we remove it from the DB
            wishlist.items = wishlist.items.filter(i => i._id.toString() !== item._id.toString());
            wishlistModified = true;
        }
    }

    // Sync the database if any broken items were purged
    if (wishlistModified) await wishlist.save();

    // Reverse the array so the most recently added items appear at the top
    return formattedItems.reverse(); 
};

// ---------------------------------------------------------
//  3. UI STATE UTILITIES
// ---------------------------------------------------------

/**
 * Returns a simple array of variant IDs (strings).
 * Essential for the frontend to know which heart icons should be 'filled' on the shop page.
 */
export const getUserWishlistVariantIds = async (userId) => {
    if (!userId) return [];
    
    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) return [];
    
    return wishlist.items.map(item => item.productVariantId.toString());
};