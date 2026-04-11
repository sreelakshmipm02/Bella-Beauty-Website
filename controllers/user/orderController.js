import Order from "../../models/order.js";
import { 
    getUserOrders, 
    getOrderById, 
    cancelMultipleItemsService, 
    returnMultipleItemsService 
} from "../../services/userServices/orderService.js";
import { generateInvoicePDF } from "../../services/userServices/invoiceService.js";

// ---------------------------------------------------------
//  1. ORDER PAGES
// ---------------------------------------------------------

/**
 * Show order success page after checkout.
 * Make sure user can only see their own order.
 */
export const getOrderSuccessPage = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.userId;

        const order = await Order.findOne({ _id: orderId, userId: userId });

        // If order not found or not owned by user
        if (!order) {
            return res.redirect('/shop');
        }

        res.render("user/orderSuccess", {
            title: "Order Successful - Bella Beauty",
            isLoggedIn: true,
            order
        });
    } catch (error) {
        console.error("Order Success Error:", error);
        res.redirect('/shop');
    }
};

/**
 * Show all orders of the user.
 * Supports simple search.
 */
export const getOrderHistoryPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        const searchQuery = req.query.search || ''; 
        
        const orders = await getUserOrders(userId, searchQuery);

        res.render("user/orders", {
            title: "My Orders - Aura",
            isLoggedIn: true,
            orders,
            searchQuery
        });
    } catch (error) {
        console.error("Order History Error:", error);
        res.redirect('/account');
    }
};

/**
 * Show details of a single order.
 */
export const getOrderDetailPage = async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Order Detail Error:", error);
        res.redirect('/orders');
    }
};

// ---------------------------------------------------------
//  2. CANCEL ORDER / ITEM
// ---------------------------------------------------------

/**
 * Cancel full order (all items).
 */
export const cancelOrderAjax = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.orderId, userId: req.session.userId });
        if (!order) throw new Error("Order not found");
        
        // Get all item IDs
        const allItemIds = order.items.map(item => item._id);

        await cancelMultipleItemsService(
            req.params.orderId,
            allItemIds,
            req.session.userId,
            req.body.reason
        );
        
        res.json({ success: true, message: "Order cancelled successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Cancel a single item.
 */
export const cancelItemAjax = async (req, res) => {
    try {
        await cancelMultipleItemsService(
            req.params.orderId,
            [req.params.itemId],
            req.session.userId,
            req.body.reason
        );
        
        res.json({ success: true, message: "Item cancelled successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------
//  3. RETURN ORDER / ITEM
// ---------------------------------------------------------

/**
 * Request return for all delivered items in an order.
 */
export const returnOrderAjax = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.orderId, userId: req.session.userId });
        if (!order) throw new Error("Order not found");
        
        // Get only delivered items
        const deliveredItemIds = order.items
            .filter(item => item.status === 'Delivered')
            .map(item => item._id);

        if (deliveredItemIds.length === 0) {
            throw new Error("No delivered items found to return.");
        }

        await returnMultipleItemsService(
            req.params.orderId,
            deliveredItemIds,
            req.session.userId,
            req.body.reason
        );
        
        res.json({ success: true, message: "Return requested successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Request return for a single item.
 */
export const returnItemAjax = async (req, res) => {
    try {
        await returnMultipleItemsService(
            req.params.orderId,
            [req.params.itemId],
            req.session.userId,
            req.body.reason
        );
        
        res.json({ success: true, message: "Item return requested successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------
//  4. INVOICE DOWNLOAD
// ---------------------------------------------------------

/**
 * Download invoice PDF.
 * Only allowed for delivered orders.
 */
export const downloadInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.session.userId;

        const order = await getOrderById(orderId, userId);
        
        if (!order || order.orderStatus !== 'Delivered') {
            return res.status(400).send("Invoice only available for delivered orders.");
        }

        const pdfBuffer = await generateInvoicePDF(order);

        // Set headers for file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderId}.pdf`);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error("Invoice Download Error:", error);
        res.status(500).send("Failed to generate invoice. Please try again later.");
    }
};