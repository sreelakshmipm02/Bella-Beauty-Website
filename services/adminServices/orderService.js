import Order from "../../models/order.js";
import ProductVariant from "../../models/productVariant.js";

// Define the strict linear order for manual updates
const MANUAL_STATUS_FLOW = ['Pending', 'Processing', 'Shipped', 'Delivered'];

export const getAdminOrdersList = async (page = 1, limit = 6, search = '', statusFilter = 'all', sortOption = 'newest') => {
    let query = {};
    if (search) query.orderId = { $regex: search, $options: 'i' };
    if (statusFilter && statusFilter !== 'all') query.orderStatus = statusFilter;

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

export const getAdminOrderById = async (orderId) => {
    return await Order.findById(orderId)
        .populate('userId', 'name email phone')
        .populate('items.productVariantId');
};

export const updateOrderStatusService = async (orderId, newStatus) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    const currentIdx = MANUAL_STATUS_FLOW.indexOf(order.orderStatus);
    const newIdx = MANUAL_STATUS_FLOW.indexOf(newStatus);

    // 1. Prevent reverting (e.g., Shipped -> Processing)
    if (currentIdx !== -1 && newIdx !== -1 && newIdx <= currentIdx && newStatus !== order.orderStatus) {
        throw new Error(`Cannot revert status from ${order.orderStatus} to ${newStatus}`);
    }

    // 2. Logic for "Returned": Admin can only set 'Returned' if a return was approved
    if (newStatus === 'Returned') {
        const hasApprovedReturn = order.items.some(item => item.status === 'Return Approved');
        if (!hasApprovedReturn) {
            throw new Error("Cannot set to Returned unless a return request has been approved.");
        }

        // Restore stock ONLY when physically marked as "Returned"
        for (let item of order.items) {
            if (item.status === 'Return Approved') {
                item.status = 'Returned';
                await ProductVariant.findByIdAndUpdate(item.productVariantId, { $inc: { stock: item.quantity } });
            }
        }
    } else {
        // Sync items that aren't locked in a terminal/return state
        order.items.forEach(item => {
            if (!['Cancelled', 'Returned', 'Return Requested', 'Return Approved', 'Return Rejected'].includes(item.status)) {
                item.status = newStatus;
            }
        });
    }

    // 3. Auto-update payment to Paid if Delivered
    if (newStatus === 'Delivered' && order.payment.status === 'Pending') {
        order.payment.status = 'Paid';
    }

    order.orderStatus = newStatus;
    await order.save();
    return order;
};

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

export const processReturnRequestService = async (orderId, itemId, action, rejectReason) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    const item = order.items.id(itemId);
    if (!item || item.status !== 'Return Requested') {
        throw new Error("Item is not pending a return request.");
    }

    if (action === 'Approve') {
        item.status = 'Return Approved';
        order.orderStatus = 'Return Approved'; // Lock master status to Approved
    } else if (action === 'Reject') {
        item.status = 'Return Rejected';
        item.adminRejectReason = rejectReason;
        order.orderStatus = 'Delivered'; // Revert back to delivered if rejected
    }

    await order.save();
    return order;
};