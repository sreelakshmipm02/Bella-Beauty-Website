import Order from "../../models/order.js";
import Cart from "../../models/cart.js";
import ProductVariant from "../../models/productVariant.js";
import { getCartData } from "./cartService.js";
import { getAddressById } from "./userAddress.js";

// ---------------------------------------------------------
//  HELPER: ORDER STATUS ENGINE
// ---------------------------------------------------------

/**
 * Recalculates the master order status based on the status of individual items.
 * This is the 'brain' that ensures the top-level status (Pending, Shipped, Returned)
 * is always in sync with what's actually happening to the items.
 */
const recalculateMasterStatus = (items) => {
    const statuses = items.map(item => item.status);

    // If every item is cancelled or returned, the whole order takes that status
    if (statuses.every(s => s === 'Cancelled')) return 'Cancelled';
    if (statuses.every(s => s === 'Returned' || s === 'Cancelled')) return 'Returned';
    
    // Priority: If any item is in 'Return Requested', the whole order flags for admin attention
    if (statuses.includes('Return Requested')) return 'Return Requested';

    // Treat 'Return Rejected' as 'Delivered' since the customer keeps the item
    const completedStates = ['Delivered', 'Returned', 'Cancelled', 'Return Rejected'];
    if (statuses.every(s => completedStates.includes(s))) return 'Delivered';

    if (statuses.includes('Shipped')) return 'Shipped';
    
    // Default logic for items still in progress
    if (statuses.includes('Processing') || statuses.includes('Delivered') || statuses.includes('Return Rejected')) {
        return 'Processing';
    }

    return 'Pending';
};

// ---------------------------------------------------------
//  1. CHECKOUT PROCESS
// ---------------------------------------------------------

/**
 * Handles the transition from Cart to Order.
 * Creates the order document, deducts inventory stock, and wipes the cart.
 */
export const processCheckout = async (userId, addressId, paymentMethod) => {
    // Validate current cart state
    const cartData = await getCartData(userId);
    if (!cartData || cartData.items.length === 0) {
        throw new Error("Your cart is empty.");
    }

    // Validate shipping destination
    const address = await getAddressById(addressId, userId);
    if (!address) {
        throw new Error("Shipping address not found.");
    }

    // Prepare items for the static order snapshot
    const orderItems = cartData.items.map(item => ({
        productVariantId: item.variantId,
        productName: item.productName,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        itemTotal: item.itemTotal,
        status: "Pending"
    }));

    // Construct the order
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

    // Inventory Sync: Deduct purchased quantities from stock
    for (let item of cartData.items) {
        await ProductVariant.findByIdAndUpdate(
            item.variantId,
            { $inc: { stock: -item.quantity } } 
        );
    }

    // Cleanup: Clear user's cart after successful order creation
    await Cart.findOneAndUpdate(
        { userId },
        { $set: { items: [] } }
    );

    return savedOrder;
};

// ---------------------------------------------------------
//  2. ORDER DATA RETRIEVAL
// ---------------------------------------------------------

/**
 * Fetches user's order history with support for Order ID or Product name search.
 */
export const getUserOrders = async (userId, searchQuery = '') => {
    let query = { userId };
    
    if (searchQuery) {
        query.$or = [
            { orderId: { $regex: searchQuery, $options: 'i' } }, 
            { "items.productName": { $regex: searchQuery, $options: 'i' } } 
        ];
    }

    return await Order.find(query).sort({ createdAt: -1 });
};

/**
 * Fetches a specific order by ID. 
 * Ownership check (userId) is mandatory for security.
 */
export const getOrderById = async (orderId, userId) => {
    return await Order.findOne({ _id: orderId, userId }).populate('items.productVariantId');
};

// ---------------------------------------------------------
//  3. POST-PURCHASE MANAGEMENT (Cancel/Return)
// ---------------------------------------------------------

/**
 * Cancels specific items from an order. 
 * Restores stock to inventory and updates the master order status.
 */
export const cancelMultipleItemsService = async (orderId, itemIds, userId, reason) => {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) throw new Error("Order not found");
    
    // Business Rule: Can't cancel once the courier has the package
    if (order.orderStatus === 'Shipped' || order.orderStatus === 'Delivered') {
        throw new Error("Cannot cancel items for an order that has already shipped.");
    }

    // 1. Process individual item cancellations
    for (let itemId of itemIds) {
        const item = order.items.id(itemId);
        if (item && item.status !== 'Cancelled') {
            // Restore stock since the items aren't leaving the warehouse
            await ProductVariant.findByIdAndUpdate(item.productVariantId, { $inc: { stock: item.quantity } });
            item.status = 'Cancelled';
            item.cancelReason = reason;
        }
    }

    // 2. Recalculate top-level status
    order.orderStatus = recalculateMasterStatus(order.items);
    
    // 3. Sync Master Reason: If the entire order is now cancelled, set the summary reason
    if (order.orderStatus === 'Cancelled') {
        order.cancelReason = reason || "Items cancelled by user";
    }

    await order.save();
    return order;
};

/**
 * Requests a return for delivered items. 
 * Enforces a 10-day return policy.
 */
export const returnMultipleItemsService = async (orderId, itemIds, userId, reason) => {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) throw new Error("Order not found");
    
    if (order.orderStatus !== 'Delivered' && order.orderStatus !== 'Returned') {
        throw new Error("Only delivered orders can be returned.");
    }

    // Policy Check: 10-day return window
    const deliveryDate = new Date(order.updatedAt);
    const diffInDays = (new Date() - deliveryDate) / (1000 * 3600 * 24);

    if (diffInDays > 10) {
        throw new Error("Return window has expired. Items can only be returned within 10 days of delivery.");
    }

    // 1. Update status of requested items
    for (let itemId of itemIds) {
        const item = order.items.id(itemId);
        if (item && item.status === 'Delivered') {
            item.status = 'Return Requested';
            item.cancelReason = reason; // We use cancelReason field to store the return logic
        }
    }

    // 2. Recalculate top-level status
    order.orderStatus = recalculateMasterStatus(order.items);

    // 3. Sync Master Reason: If the entire order is now returned, set the summary reason
    if (order.orderStatus === 'Returned') {
        order.returnReason = "Items returned by user";
    }

    await order.save();
    return order;
};