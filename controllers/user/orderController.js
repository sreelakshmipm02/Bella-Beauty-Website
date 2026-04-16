import Order from "../../models/order.js";
import { 
    getUserOrders, 
    getOrderById, 
    cancelMultipleItemsService, 
    returnMultipleItemsService 
} from "../../services/userServices/orderService.js";
import { generateInvoicePDF } from "../../services/userServices/invoiceService.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";

// ---------------------------------------------------------
//  1. ORDER PAGES
// ---------------------------------------------------------

/**
 * Show order success page after checkout.
 * Make sure user can only see their own order.
 */
export const getOrderSuccessPage = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const userId = req.session.userId;
    const order = await Order.findOne({ _id: orderId, userId: userId });

    if (!order) {
        return res.redirect('/shop');
    }

    res.render("user/orderSuccess", {
        title: "Order Successful - Bella Beauty",
        isLoggedIn: true,
        order
    });
});

/**
 * Show all orders of the user.
 * Supports simple search.
 */
export const getOrderHistoryPage = asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const searchQuery = req.query.search || '';
    const orders = await getUserOrders(userId, searchQuery);

    res.render("user/orders", {
        title: "My Orders - Aura",
        isLoggedIn: true,
        orders,
        searchQuery
    });
});

/**
 * Show details of a single order.
 */
export const getOrderDetailPage = asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const order = await getOrderById(req.params.orderId, userId);

    if (!order) {
        return res.redirect('/orders');
    }

    res.render("user/orderDetail", {
        title: `Order ${order.orderId} - Aura`,
        isLoggedIn: true,
        order
    });
});

// ---------------------------------------------------------
//  2. CANCEL ORDER / ITEM
// ---------------------------------------------------------

/**
 * Cancel full order (all items).
 */
export const cancelOrderAjax = asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.session.userId });
    if (!order) throw new AppError("Order not found", 404);

    const allItemIds = order.items.map(item => item._id);
    await cancelMultipleItemsService(req.params.orderId, allItemIds, req.session.userId, req.body.reason);

    res.status(200).json({ success: true, message: "Order cancelled successfully." });
});

/**
 * Cancel a single item.
 */
export const cancelItemAjax = asyncHandler(async (req, res) => {
    await cancelMultipleItemsService(req.params.orderId, [req.params.itemId], req.session.userId, req.body.reason);
    res.status(200).json({ success: true, message: "Item cancelled successfully." });
});

// ---------------------------------------------------------
//  3. RETURN ORDER / ITEM
// ---------------------------------------------------------

/**
 * Request return for all delivered items in an order.
 */
export const returnOrderAjax = asyncHandler(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.orderId, userId: req.session.userId });
    if (!order) throw new AppError("Order not found", 404);

    const deliveredItemIds = order.items.filter(item => item.status === 'Delivered').map(item => item._id);
    if (deliveredItemIds.length === 0) {
        throw new AppError("No delivered items found to return.", 400);
    }

    await returnMultipleItemsService(req.params.orderId, deliveredItemIds, req.session.userId, req.body.reason);
    res.status(200).json({ success: true, message: "Return requested successfully." });
});

/**
 * Request return for a single item.
 */
export const returnItemAjax = asyncHandler(async (req, res) => {
    await returnMultipleItemsService(req.params.orderId, [req.params.itemId], req.session.userId, req.body.reason);
    res.status(200).json({ success: true, message: "Item return requested successfully." });
});

// ---------------------------------------------------------
//  4. INVOICE DOWNLOAD
// ---------------------------------------------------------

/**
 * Download invoice PDF.
 * Only allowed for delivered orders.
 */
export const downloadInvoice = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const userId = req.session.userId;
    const order = await getOrderById(orderId, userId);

    if (!order || order.orderStatus !== 'Delivered') {
        throw new AppError("Invoice only available for delivered orders.", 400);
    }

    const pdfBuffer = await generateInvoicePDF(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderId}.pdf`);
    res.send(pdfBuffer);
});
