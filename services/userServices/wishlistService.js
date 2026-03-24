import Wishlist from "../../models/wishlist.js";
import ProductVariant from "../../models/productVariant.js";

// 1. Toggle Item (Add/Remove)
export const toggleWishlistItem = async (userId, variantId) => {
    let wishlist = await Wishlist.findOne({ userId });
    
    if (!wishlist) {
        wishlist = new Wishlist({ userId, items: [] });
    }

    const itemIndex = wishlist.items.findIndex(item => item.productVariantId.toString() === variantId.toString());
    let isAdded = false;

    if (itemIndex > -1) {
        wishlist.items.splice(itemIndex, 1); // Remove it
    } else {
        wishlist.items.push({ productVariantId: variantId }); // Add it
        isAdded = true;
    }

    await wishlist.save();
    return { isAdded, totalItems: wishlist.items.length };
};

// 2. Remove Item (Used when moving to cart)
export const removeWishlistItem = async (userId, variantId) => {
    await Wishlist.updateOne(
        { userId },
        { $pull: { items: { productVariantId: variantId } } }
    );
};

// 3. Get Full Data (For the Wishlist Page)
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
        
        if (variant && variant.status === 'active' && variant.productId && variant.productId.status === 'active') {
            formattedItems.push({
                variantId: variant._id,
                productName: variant.productId.name,
                brand: variant.productId.brand,
                slug: variant.productId.slug,
                image: variant.images[0],
                price: variant.price,
                stock: variant.stock,
                attributes: variant.attributes,
                addedAt: item.addedAt
            });
        } else {
            // Clean up broken/disabled items silently
            wishlist.items = wishlist.items.filter(i => i._id.toString() !== item._id.toString());
            wishlistModified = true;
        }
    }

    if (wishlistModified) await wishlist.save();
    return formattedItems.reverse(); // Newest first
};

// 4. Get Variant IDs (For the Heart Button UI state)
export const getUserWishlistVariantIds = async (userId) => {
    if (!userId) return [];
    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) return [];
    return wishlist.items.map(item => item.productVariantId.toString());
};