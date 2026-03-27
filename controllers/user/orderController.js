import Order from "../../models/order.js";
import { 
    getUserOrders, 
    getOrderById, 
    cancelMultipleItemsService, 
    returnMultipleItemsService 
} from "../../services/userServices/orderService.js";

// ==========================================
// 1. ORDER SUCCESS PAGE
// ==========================================
export const getOrderSuccessPage = async (req, res) => {
    try {
        const orderId = req.params.orderId;
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

// ==========================================
// 2. ORDER HISTORY PAGE (With Search)
// ==========================================
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

// ==========================================
// 3. ORDER DETAIL PAGE
// ==========================================
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

// ==========================================
// 4. CANCEL ENTIRE ORDER AJAX
// ==========================================
export const cancelOrderAjax = async (req, res) => {
    try {
        // Fetch the order to get all item IDs
        const order = await Order.findOne({ _id: req.params.orderId, userId: req.session.userId });
        if (!order) throw new Error("Order not found");
        
        // Extract all item IDs into an array
        const allItemIds = order.items.map(item => item._id);

        // Pass the array to our smart service
        await cancelMultipleItemsService(req.params.orderId, allItemIds, req.session.userId, req.body.reason);
        
        res.json({ success: true, message: "Order cancelled successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ==========================================
// 5. CANCEL SINGLE ITEM AJAX
// ==========================================
export const cancelItemAjax = async (req, res) => {
    try {
        // We wrap the single itemId from the URL into an array: [req.params.itemId]
        await cancelMultipleItemsService(req.params.orderId, [req.params.itemId], req.session.userId, req.body.reason);
        
        res.json({ success: true, message: "Item cancelled successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ==========================================
// 6. REQUEST RETURN AJAX
// ==========================================
export const returnOrderAjax = async (req, res) => {
    try {
        // Fetch order to find which items were actually delivered
        const order = await Order.findOne({ _id: req.params.orderId, userId: req.session.userId });
        if (!order) throw new Error("Order not found");
        
        // Extract only the IDs of items that are 'Delivered'
        const deliveredItemIds = order.items
            .filter(item => item.status === 'Delivered')
            .map(item => item._id);

        if (deliveredItemIds.length === 0) {
            throw new Error("No delivered items found to return.");
        }

        // Pass the array to our smart service
        await returnMultipleItemsService(req.params.orderId, deliveredItemIds, req.session.userId, req.body.reason);
        
        res.json({ success: true, message: "Return requested successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// ==========================================
// 7. RETURN SINGLE ITEM AJAX
// ==========================================
export const returnItemAjax = async (req, res) => {
    try {
        // We wrap the single itemId from the URL into an array: [req.params.itemId]
        await returnMultipleItemsService(req.params.orderId, [req.params.itemId], req.session.userId, req.body.reason);
        
        res.json({ success: true, message: "Item return requested successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};