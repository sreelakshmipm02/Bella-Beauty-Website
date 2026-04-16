import { 
    getAdminOrdersList, 
    getAdminOrderById, 
    updateOrderStatusService, 
    processReturnRequestService, 
    updatePaymentStatusService 
} from "../../services/adminServices/orderService.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";

/**
 * Show orders page with pagination, search, filter, and sorting.
 */
export const getOrdersPage = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const { search, status, sort } = req.query;
    const { orders, totalOrders } = await getAdminOrdersList(page, limit, search, status, sort);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render("admin/orders", {
        title: "Manage Orders",
        orders,
        currentPage: page,
        totalPages,
        searchQuery: search || '',
        currentStatus: status || 'all',
        currentSort: sort || 'newest'
    });
});

/**
 * Show single order details page.
 */
export const getAdminOrderDetailPage = asyncHandler(async (req, res) => {
    const order = await getAdminOrderById(req.params.id);
    if (!order) return res.redirect('/admin/orders');
    res.render("admin/orderDetail", { title: `Order Details - ${order.orderId}`, order });
});

/**
 * Update order status using AJAX.
 */
export const updateOrderStatusAjax = asyncHandler(async (req, res) => {
    const { status } = req.body;
    await updateOrderStatusService(req.params.id, status);
    res.status(200).json({ success: true, message: `Order status updated to ${status}.` });
});

/**
 * Handle return approval or rejection using AJAX.
 */
export const processReturnAjax = asyncHandler(async (req, res) => {
    const { action, rejectReason } = req.body;
    await processReturnRequestService(req.params.orderId, req.params.itemId, action, rejectReason);
    res.status(200).json({ success: true, message: `Return ${action.toLowerCase()}ed successfully.` });
});

/**
 * Update payment status using AJAX.
 */
export const updatePaymentStatusAjax = asyncHandler(async (req, res) => {
    const { status } = req.body;
    await updatePaymentStatusService(req.params.id, status);
    res.status(200).json({ success: true, message: `Payment status updated to ${status}.` });
});
