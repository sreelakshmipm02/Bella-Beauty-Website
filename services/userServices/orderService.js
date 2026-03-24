import Order from "../../models/order.js";
import Cart from "../../models/cart.js";
import ProductVariant from "../../models/productVariant.js";
import { getCartData } from "./cartService.js";
import { getAddressById } from "./userAddress.js";

export const processCheckout = async (userId, addressId, paymentMethod) => {
    // 1. Fetch Cart & Address
    const cartData = await getCartData(userId);
    if (!cartData || cartData.items.length === 0) {
        throw new Error("Your cart is empty.");
    }

    const address = await getAddressById(addressId, userId);
    if (!address) {
        throw new Error("Shipping address not found.");
    }

    // 2. Format Items for the Order Snapshot
    const orderItems = cartData.items.map(item => ({
        productVariantId: item.variantId,
        productName: item.productName,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        itemTotal: item.itemTotal,
        status: "Pending"
    }));

    // 3. Create the Order Document
    const newOrder = new Order({
        userId,
        items: orderItems,
        shippingAddress: {
            fullName: address.fullName,
            phone: address.phone,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            country: address.country
        },
        payment: {
            method: paymentMethod,
            status: paymentMethod === 'COD' ? 'Pending' : 'Paid'
        },
        summary: cartData.summary,
        orderStatus: "Pending"
    });

    const savedOrder = await newOrder.save();

    // 4. DEDUCT STOCK DYNAMICALLY
    for (let item of cartData.items) {
        await ProductVariant.findByIdAndUpdate(
            item.variantId,
            { $inc: { stock: -item.quantity } } // Subtracts the purchased amount
        );
    }

    // 5. EMPTY THE CART
    await Cart.findOneAndUpdate(
        { userId },
        { $set: { items: [] } }
    );

    return savedOrder;
};

// ==========================================
// FETCH USER ORDERS (With Search)
// ==========================================
export const getUserOrders = async (userId, searchQuery = '') => {
    let query = { userId };
    
    // If the user types in the search bar, look for matching Order IDs
    if (searchQuery) {
        query.orderId = { $regex: searchQuery, $options: 'i' };
    }

    // Sort by newest first
    return await Order.find(query).sort({ createdAt: -1 });
};

// ==========================================
// FETCH SINGLE ORDER DETAILS
// ==========================================
export const getOrderById = async (orderId, userId) => {
    // We include userId in the query to strictly prevent users from viewing others' receipts
    return await Order.findOne({ _id: orderId, userId }).populate('items.productVariantId');
};