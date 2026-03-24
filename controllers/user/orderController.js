import Order from "../../models/order.js";
import { getUserOrders, getOrderById } from "../../services/userServices/orderService.js";


// Render the Order Success / Thank You Page
export const getOrderSuccessPage = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.userId;

        // Fetch the order. We include userId in the query as a strict security check
        // so users can't randomly guess URLs and view other people's receipts!
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
// 1. ORDER LISTING PAGE (With Search)
// ==========================================
export const getOrderHistoryPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        const searchQuery = req.query.search || ''; // Grab search term from URL
        
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
// 2. ORDER DETAIL PAGE
// ==========================================
export const getOrderDetailPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        const order = await getOrderById(req.params.orderId, userId);

        if (!order) {
            return res.redirect('/account/orders');
        }

        res.render("user/orderDetail", {
            title: `Order ${order.orderId} - Aura`,
            isLoggedIn: true,
            order
        });
    } catch (error) {
        console.error("Order Detail Error:", error);
        res.redirect('/account/orders');
    }
};