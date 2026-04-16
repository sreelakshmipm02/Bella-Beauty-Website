import Order from "../../models/order.js";
import ProductVariant from "../../models/productVariant.js";
import AppError from "../../utils/AppError.js";

// Order status should follow this step-by-step flow
const MANUAL_STATUS_FLOW = ['Pending', 'Processing', 'Shipped', 'Delivered'];

export const getAdminOrdersList = async (page = 1, limit = 6, search = '', statusFilter = 'all', sortOption = 'newest') => {
    let query = {};

    // Search order using orderId
    if (search) query.orderId = { $regex: search, $options: 'i' };

    // Filter by order status (if selected)
    if (statusFilter && statusFilter !== 'all') query.orderStatus = statusFilter;

    // Default sorting: newest orders first
    let sortQuery = { createdAt: -1 }; 

    if (sortOption === 'oldest') sortQuery = { createdAt: 1 };

    // Sort by total amount
    if (sortOption === 'amount_desc') sortQuery = { 'summary.total': -1 }; 
    if (sortOption === 'amount_asc') sortQuery = { 'summary.total': 1 };   

    // Pagination logic
    const skip = (page - 1) * limit;

    // Get orders with user details
    const orders = await Order.find(query)
        .populate('userId', 'name email')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit);

    // Total count for pagination
    const totalOrders = await Order.countDocuments(query);

    return { orders, totalOrders };
};

export const getAdminOrderById = async (orderId) => {
    // Get full order details with user and product info
    return await Order.findById(orderId)
        .populate('userId', 'name email phone')
        .populate('items.productVariantId');
};

export const updateOrderStatusService = async (orderId, newStatus) => {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);

    const currentIdx = MANUAL_STATUS_FLOW.indexOf(order.orderStatus);
    const newIdx = MANUAL_STATUS_FLOW.indexOf(newStatus);

    // Do not allow moving backwards in status (like Shipped -> Processing)
    if (currentIdx !== -1 && newIdx !== -1 && newIdx <= currentIdx && newStatus !== order.orderStatus) {
        throw new AppError(`Cannot revert status from ${order.orderStatus} to ${newStatus}`, 400);
    }

    // If setting status to Returned, make sure return is approved
    if (newStatus === 'Returned') {
        const hasApprovedReturn = order.items.some(item => item.status === 'Return Approved');

        if (!hasApprovedReturn) {
            throw new AppError("Cannot set to Returned unless a return request has been approved.", 400);
        }

        // Add stock back only for approved return items
        for (let item of order.items) {
            if (item.status === 'Return Approved') {
                item.status = 'Returned';

                await ProductVariant.findByIdAndUpdate(
                    item.productVariantId,
                    { $inc: { stock: item.quantity } }
                );
            }
        }
    } else {
        // Update item status only if it's not already in a final state
        order.items.forEach(item => {
            if (!['Cancelled', 'Returned', 'Return Requested', 'Return Approved', 'Return Rejected'].includes(item.status)) {
                item.status = newStatus;
            }
        });
    }

    // If delivered, mark payment as paid (if still pending)
    if (newStatus === 'Delivered' && order.payment.status === 'Pending') {
        order.payment.status = 'Paid';
    }

    order.orderStatus = newStatus;

    await order.save();
    return order;
};

export const updatePaymentStatusService = async (orderId, newStatus) => {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);

    // Do not allow changes if already refunded
    if (order.payment.status === 'Refunded') {
        throw new AppError("Cannot change status of a refunded payment.", 400);
    }

    order.payment.status = newStatus;

    await order.save();
    return order;
};

export const processReturnRequestService = async (orderId, itemId, action, rejectReason) => {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError("Order not found", 404);

    // Find the specific item inside the order
    const item = order.items.id(itemId);

    // Check if item is actually waiting for return approval
    if (!item || item.status !== 'Return Requested') {
        throw new AppError("Item is not pending a return request.", 400);
    }

    if (action === 'Approve') {
        item.status = 'Return Approved';

        // Lock order status as return approved
        order.orderStatus = 'Return Approved';

    } else if (action === 'Reject') {
        item.status = 'Return Rejected';
        item.adminRejectReason = rejectReason;

        // If rejected, keep order as delivered
        order.orderStatus = 'Delivered';
    }

    await order.save();
    return order;
};
