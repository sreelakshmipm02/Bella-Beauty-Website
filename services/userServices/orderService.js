import Order from "../../models/order.js";
import Cart from "../../models/cart.js";
import ProductVariant from "../../models/productVariant.js";
import { getCartData } from "./cartService.js";
import { getAddressById } from "./userAddress.js";

// ==========================================
// HELPER: RECALCULATE MASTER ORDER STATUS
// ==========================================
const recalculateMasterStatus = (items) => {
    const statuses = items.map(item => item.status);

    if (statuses.every(s => s === 'Cancelled')) return 'Cancelled';
    if (statuses.every(s => s === 'Returned' || s === 'Cancelled')) return 'Returned';
    
    // NEW: If any item is requesting a return, flag the whole order so the admin notices!
    if (statuses.includes('Return Requested')) return 'Return Requested';

    // Treat 'Return Rejected' as essentially 'Delivered' (since the user keeps it)
    if (statuses.every(s => s === 'Delivered' || s === 'Returned' || s === 'Cancelled' || s === 'Return Rejected')) return 'Delivered';

    if (statuses.includes('Shipped')) return 'Shipped';
    if (statuses.includes('Processing') || statuses.includes('Delivered') || statuses.includes('Return Rejected')) return 'Processing';

    return 'Pending';
};

// ==========================================
// PROCESS CHECKOUT
// ==========================================
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
            { $inc: { stock: -item.quantity } } 
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
// FETCH USER ORDERS (With Powerful Search)
// ==========================================
export const getUserOrders = async (userId, searchQuery = '') => {
    let query = { userId };
    
    // If the user types in the search bar, look for matching Order IDs OR Product Names
    if (searchQuery) {
        query.$or = [
            { orderId: { $regex: searchQuery, $options: 'i' } }, 
            { "items.productName": { $regex: searchQuery, $options: 'i' } } 
        ];
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

// ==========================================
// CANCEL MULTIPLE ITEMS 
// ==========================================
export const cancelMultipleItemsService = async (orderId, itemIds, userId, reason) => {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) throw new Error("Order not found");
    if (order.orderStatus === 'Shipped' || order.orderStatus === 'Delivered') {
        throw new Error("Cannot cancel items for an order that has already shipped.");
    }

    // 1. Cancel the specific items and return stock
    for (let itemId of itemIds) {
        const item = order.items.id(itemId);
        if (item && item.status !== 'Cancelled') {
            await ProductVariant.findByIdAndUpdate(item.productVariantId, { $inc: { stock: item.quantity } });
            item.status = 'Cancelled';
            item.cancelReason = reason;
        }
    }

    // 2. Recalculate the master order status intelligently
    order.orderStatus = recalculateMasterStatus(order.items);
    
    // If it decided the whole order is cancelled, set the master reason
    if (order.orderStatus === 'Cancelled') {
        order.cancelReason = "Items cancelled by user";
    }

    await order.save();
    return order;
};

// ==========================================
// RETURN MULTIPLE ITEMS
// ==========================================
export const returnMultipleItemsService = async (orderId, itemIds, userId, reason) => {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) throw new Error("Order not found");
    
    // Check if the overall order has at least reached the delivered phase
    if (order.orderStatus !== 'Delivered' && order.orderStatus !== 'Returned') {
        throw new Error("Only delivered orders can be returned.");
    }

    const deliveryDate = new Date(order.updatedAt);
    const diffInDays = (new Date() - deliveryDate) / (1000 * 3600 * 24);

    if (diffInDays > 10) {
        throw new Error("Return window has expired. Items can only be returned within 10 days of delivery.");
    }

    // 1. Return the specific items
    for (let itemId of itemIds) {
        const item = order.items.id(itemId);
        if (item && item.status === 'Delivered') {
            item.status = 'Return Requested';
            item.cancelReason = reason; 
        }
    }

    // 2. Recalculate the master order status intelligently
    order.orderStatus = recalculateMasterStatus(order.items);

    // If it decided the whole order is returned, set the master reason
    if (order.orderStatus === 'Returned') {
        order.returnReason = "Items returned by user";
    }

    await order.save();
    return order;
};