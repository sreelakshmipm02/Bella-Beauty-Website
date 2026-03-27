import Order from "../../models/order.js";
import ProductVariant from "../../models/productVariant.js";

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
// 1. FETCH ALL ORDERS (With Filters, Sort & Pagination)
// ==========================================
export const getAdminOrdersList = async (page = 1, limit = 6, search = '', statusFilter = 'all', sortOption = 'newest') => {
    let query = {};

    // Search by Order ID
    if (search) {
        query.orderId = { $regex: search, $options: 'i' };
    }

    // Filter by exact status
    if (statusFilter && statusFilter !== 'all') {
        query.orderStatus = statusFilter;
    }

    // Determine the sorting order
    let sortQuery = { createdAt: -1 }; // Default: Newest first
    if (sortOption === 'oldest') sortQuery = { createdAt: 1 };
    if (sortOption === 'amount_desc') sortQuery = { 'summary.total': -1 }; // Highest amount first
    if (sortOption === 'amount_asc') sortQuery = { 'summary.total': 1 };   // Lowest amount first

    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
        .populate('userId', 'name email')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit);

    const totalOrders = await Order.countDocuments(query);

    return { orders, totalOrders };
};

// ==========================================
// 2. FETCH SINGLE ORDER DETAILS
// ==========================================
export const getAdminOrderById = async (orderId) => {
    return await Order.findById(orderId)
        .populate('userId', 'name email phone')
        .populate('items.productVariantId');
};

// ==========================================
// 3. UPDATE ORDER STATUS
// ==========================================
export const updateOrderStatusService = async (orderId, newStatus) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    if (order.orderStatus === 'Cancelled' || order.orderStatus === 'Returned') {
        throw new Error(`Cannot change status. Order is already ${order.orderStatus}.`);
    }

    // Cascade the new status to all items that aren't already Cancelled or Returned by the user
    order.items.forEach(item => {
        if (item.status !== 'Cancelled' && item.status !== 'Returned') {
            item.status = newStatus;
        }
    });

    // Run our smart recalculator just to be safe!
    order.orderStatus = recalculateMasterStatus(order.items);

    await order.save();
    return order;
};

// ==========================================
// 4. PROCESS RETURN REQUEST (APPROVE/REJECT)
// ==========================================
export const processReturnRequestService = async (orderId, itemId, action, rejectReason) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    const item = order.items.id(itemId);
    if (!item || item.status !== 'Return Requested') {
        throw new Error("Item is not pending a return request.");
    }

    if (action === 'Approve') {
        item.status = 'Returned';
        // When a return is approved, we restore the stock!
        await ProductVariant.findByIdAndUpdate(item.productVariantId, { $inc: { stock: item.quantity } });
    } else if (action === 'Reject') {
        item.status = 'Return Rejected';
        item.adminRejectReason = rejectReason;
    }

    // Recalculate master status
    order.orderStatus = recalculateMasterStatus(order.items);
    await order.save();
    
    return order;
};