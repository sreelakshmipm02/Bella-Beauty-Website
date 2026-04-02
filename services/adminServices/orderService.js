import Order from "../../models/order.js";
import ProductVariant from "../../models/productVariant.js";

// ---------------------------------------------------------
//  HELPER: MASTER STATUS RECALCULATOR
// ---------------------------------------------------------

/**
 * Determines the overall order status based on individual item states.
 * This ensures the 'Main Status' on the dashboard accurately reflects 
 * what's happening with the items inside (Cancellations, Returns, etc).
 */
const recalculateMasterStatus = (items) => {
    const statuses = items.map(item => item.status);

    // If every single item is gone, the whole order is closed
    if (statuses.every(s => s === 'Cancelled')) return 'Cancelled';
    if (statuses.every(s => s === 'Returned' || s === 'Cancelled')) return 'Returned';
    
    // Priority: If any item needs admin attention for a return, flag the whole order
    if (statuses.includes('Return Requested')) return 'Return Requested';

    // If items are mixed (some kept, some returned/rejected), it counts as a completed delivery
    const completedStates = ['Delivered', 'Returned', 'Cancelled', 'Return Rejected'];
    if (statuses.every(s => completedStates.includes(s))) return 'Delivered';

    if (statuses.includes('Shipped')) return 'Shipped';
    
    // Default fallback for items still in progress
    if (statuses.includes('Processing') || statuses.includes('Delivered') || statuses.includes('Return Rejected')) {
        return 'Processing';
    }

    return 'Pending';
};

// ---------------------------------------------------------
//  1. ORDER DATA RETRIEVAL
// ---------------------------------------------------------

/**
 * Fetches a filtered and sorted list of all customer orders.
 * Supports searching by Order ID and sorting by date or total amount.
 */
export const getAdminOrdersList = async (page = 1, limit = 6, search = '', statusFilter = 'all', sortOption = 'newest') => {
    let query = {};

    if (search) {
        query.orderId = { $regex: search, $options: 'i' };
    }

    if (statusFilter && statusFilter !== 'all') {
        query.orderStatus = statusFilter;
    }

    // Sorting Map
    let sortQuery = { createdAt: -1 }; 
    if (sortOption === 'oldest') sortQuery = { createdAt: 1 };
    if (sortOption === 'amount_desc') sortQuery = { 'summary.total': -1 }; 
    if (sortOption === 'amount_asc') sortQuery = { 'summary.total': 1 };   

    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
        .populate('userId', 'name email')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit);

    const totalOrders = await Order.countDocuments(query);

    return { orders, totalOrders };
};

/**
 * Fetches full details for a specific order, including customer 
 * contact info and product variant data for the admin view.
 */
export const getAdminOrderById = async (orderId) => {
    return await Order.findById(orderId)
        .populate('userId', 'name email phone')
        .populate('items.productVariantId');
};

// ---------------------------------------------------------
//  2. STATUS & PAYMENT MANAGEMENT
// ---------------------------------------------------------

/**
 * Updates the order status and cascades the change down to the items.
 * Does not overwrite items that have already been manually Cancelled or Returned.
 */
export const updateOrderStatusService = async (orderId, newStatus) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    // Guard clause: Don't allow updates to closed orders
    if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Returned') {
        throw new Error(`Cannot change status. Order is already ${order.orderStatus}.`);
    }

    // Batch update items while respecting user-driven cancellations
    order.items.forEach(item => {
        if (item.status !== 'Cancelled' && item.status !== 'Returned') {
            item.status = newStatus;
        }
    });

    order.orderStatus = recalculateMasterStatus(order.items);

    await order.save();
    return order;
};

/**
 * Manually adjusts payment status (e.g., marking a COD order as Paid).
 */
export const updatePaymentStatusService = async (orderId, newStatus) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    if (order.payment.status === 'Refunded') {
        throw new Error("Cannot change status of a refunded payment.");
    }

    order.payment.status = newStatus;
    await order.save();
    
    return order;
};

// ---------------------------------------------------------
//  3. RETURN PROCESSING
// ---------------------------------------------------------

/**
 * Approves or Rejects a customer return request.
 * If approved, it automatically restores the product stock to the inventory.
 */
export const processReturnRequestService = async (orderId, itemId, action, rejectReason) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    const item = order.items.id(itemId);
    if (!item || item.status !== 'Return Requested') {
        throw new Error("Item is not pending a return request.");
    }

    if (action === 'Approve') {
        item.status = 'Returned';
        // Logic: Put the item back in stock since the customer returned it
        await ProductVariant.findByIdAndUpdate(item.productVariantId, { $inc: { stock: item.quantity } });
    } else if (action === 'Reject') {
        item.status = 'Return Rejected';
        item.adminRejectReason = rejectReason;
    }

    order.orderStatus = recalculateMasterStatus(order.items);
    await order.save();
    
    return order;
};