import Order from "../../models/order.js";
import Cart from "../../models/cart.js";
import ProductVariant from "../../models/productVariant.js";
import { getCartData } from "./cartService.js";
import { getAddressById } from "./userAddress.js";

// This function decides the overall order status based on item statuses
const recalculateMasterStatus = (items) => {

    const statuses = items.map(item => item.status);

    // If all items are cancelled
    if (statuses.every(s => s === 'Cancelled')) return 'Cancelled';

    // If all items are returned or cancelled
    if (statuses.every(s => s === 'Returned' || s === 'Cancelled')) return 'Returned';
    
    // If any item has return request
    if (statuses.includes('Return Requested')) return 'Return Requested';

    // Treat completed states as delivered
    const completedStates = ['Delivered', 'Returned', 'Cancelled', 'Return Rejected'];

    if (statuses.every(s => completedStates.includes(s))) return 'Delivered';

    // If any item is shipped
    if (statuses.includes('Shipped')) return 'Shipped';
    
    // If order is still in progress
    if (statuses.includes('Processing') || statuses.includes('Delivered') || statuses.includes('Return Rejected')) {
        return 'Processing';
    }

    // Default status
    return 'Pending';
};

// -------------------------------
// 1. CHECKOUT
// -------------------------------

// This function converts cart into an order
export const processCheckout = async (userId, addressId, paymentMethod) => {

    // Get cart data
    const cartData = await getCartData(userId);

    if (!cartData || cartData.items.length === 0) {
        throw new Error("Your cart is empty.");
    }

    // Get selected address
    const address = await getAddressById(addressId, userId);

    if (!address) {
        throw new Error("Shipping address not found.");
    }

    // Prepare items for order
    const orderItems = cartData.items.map(item => ({
        productVariantId: item.variantId,
        productName: item.productName,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        itemTotal: item.itemTotal,
        status: "Pending"
    }));

    // Create new order
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

    // Reduce stock after order placed
    for (let item of cartData.items) {
        await ProductVariant.findByIdAndUpdate(
            item.variantId,
            { $inc: { stock: -item.quantity } }
        );
    }

    // Clear cart after successful checkout
    await Cart.findOneAndUpdate(
        { userId },
        { $set: { items: [] } }
    );

    return savedOrder;
};

// -------------------------------
// 2. GET ORDERS
// -------------------------------

// Get all orders of a user (with optional search)
export const getUserOrders = async (userId, searchQuery = '') => {

    let query = { userId };
    
    // Search by order ID or product name
    if (searchQuery) {
        query.$or = [
            { orderId: { $regex: searchQuery, $options: 'i' } }, 
            { "items.productName": { $regex: searchQuery, $options: 'i' } } 
        ];
    }

    return await Order.find(query).sort({ createdAt: -1 });
};

// Get single order by ID
export const getOrderById = async (orderId, userId) => {
    return await Order.findOne({ _id: orderId, userId })
        .populate('items.productVariantId');
};

// -------------------------------
// 3. CANCEL ITEMS
// -------------------------------

// Cancel selected items in an order
export const cancelMultipleItemsService = async (orderId, itemIds, userId, reason) => {

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) throw new Error("Order not found");
    
    // Cannot cancel after shipping
    if (order.orderStatus === 'Shipped' || order.orderStatus === 'Delivered') {
        throw new Error("Cannot cancel items after shipping.");
    }

    // Process each item
    for (let itemId of itemIds) {

        const item = order.items.id(itemId);

        if (item && item.status !== 'Cancelled') {

            // Add stock back
            await ProductVariant.findByIdAndUpdate(
                item.productVariantId,
                { $inc: { stock: item.quantity } }
            );

            item.status = 'Cancelled';
            item.cancelReason = reason;
        }
    }

    // Update main order status
    order.orderStatus = recalculateMasterStatus(order.items);
    
    // If full order cancelled
    if (order.orderStatus === 'Cancelled') {
        order.cancelReason = reason || "Cancelled by user";
    }

    await order.save();

    return order;
};

// -------------------------------
// 4. RETURN ITEMS
// -------------------------------

// Request return for items
export const returnMultipleItemsService = async (orderId, itemIds, userId, reason) => {

    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) throw new Error("Order not found");
    
    // Only delivered orders can be returned
    if (order.orderStatus !== 'Delivered' && order.orderStatus !== 'Returned') {
        throw new Error("Only delivered orders can be returned.");
    }

    // Check 10-day return policy
    const deliveryDate = new Date(order.updatedAt);

    const diffInDays = (new Date() - deliveryDate) / (1000 * 3600 * 24);

    if (diffInDays > 10) {
        throw new Error("Return allowed only within 10 days.");
    }

    // Update item status
    for (let itemId of itemIds) {

        const item = order.items.id(itemId);

        if (item && item.status === 'Delivered') {
            item.status = 'Return Requested';
            item.cancelReason = reason; // reuse field for reason
        }
    }

    // Update main order status
    order.orderStatus = recalculateMasterStatus(order.items);

    // If fully returned
    if (order.orderStatus === 'Returned') {
        order.returnReason = "Returned by user";
    }

    await order.save();

    return order;
};