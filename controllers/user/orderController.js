import Order from "../../models/order.js";
import { 
    getUserOrders, 
    getOrderById, 
    cancelMultipleItemsService, 
    returnMultipleItemsService 
} from "../../services/userServices/orderService.js";
import { generateInvoicePDF } from "../../services/userServices/invoiceService.js";

// ---------------------------------------------------------
//  1. ORDER VIEWS (Success, History, & Detail)
// ---------------------------------------------------------

/**
 * Renders the confirmation page immediately after a successful checkout.
 * We perform a quick ownership check to ensure users can't guess order IDs 
 * to see other people's success pages.
 */
export const getOrderSuccessPage = async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Order Success Error:", error);
        res.redirect('/shop');
    }
};

/**
 * Renders the list of all orders a user has placed.
 * Supports a simple search query to filter by Order ID or Product names.
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
 * Renders the full breakdown of a single order.
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
//  2. CANCELLATION LOGIC (AJAX)
// ---------------------------------------------------------

/**
 * Cancels all eligible items in an order at once.
 */
export const cancelOrderAjax = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.orderId, userId: req.session.userId });
        if (!order) throw new Error("Order not found");
        
        // We map all item IDs to treat the "Whole Order" as a multi-item cancellation
        const allItemIds = order.items.map(item => item._id);

        await cancelMultipleItemsService(req.params.orderId, allItemIds, req.session.userId, req.body.reason);
        
        res.json({ success: true, message: "Order cancelled successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Cancels a specific single item from an order.
 */
export const cancelItemAjax = async (req, res) => {
    try {
        // We wrap the single ID in an array to keep the service layer call consistent
        await cancelMultipleItemsService(req.params.orderId, [req.params.itemId], req.session.userId, req.body.reason);
        
        res.json({ success: true, message: "Item cancelled successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------
//  3. RETURN LOGIC (AJAX)
// ---------------------------------------------------------

/**
 * Requests a return for the entire order. 
 * Only items with a status of 'Delivered' are processed for return.
 */
export const returnOrderAjax = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.params.orderId, userId: req.session.userId });
        if (!order) throw new Error("Order not found");
        
        const deliveredItemIds = order.items
            .filter(item => item.status === 'Delivered')
            .map(item => item._id);

        if (deliveredItemIds.length === 0) {
            throw new Error("No delivered items found to return.");
        }

        await returnMultipleItemsService(req.params.orderId, deliveredItemIds, req.session.userId, req.body.reason);
        
        res.json({ success: true, message: "Return requested successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Requests a return for one specific item.
 */
export const returnItemAjax = async (req, res) => {
    try {
        await returnMultipleItemsService(req.params.orderId, [req.params.itemId], req.session.userId, req.body.reason);
        
        res.json({ success: true, message: "Item return requested successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------
//  4. DOCUMENT GENERATION
// ---------------------------------------------------------

/**
 * Generates and triggers a PDF download for the order invoice.
 * We only allow this for delivered orders to ensure the transaction is finalized.
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

        // Set headers to tell the browser to treat this as a downloadable PDF file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderId}.pdf`);
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error("Invoice Download Error:", error);
        res.status(500).send("Failed to generate invoice. Please try again later.");
    }
};