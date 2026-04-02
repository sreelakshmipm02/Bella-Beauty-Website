import { 
    getAdminOrdersList, 
    getAdminOrderById, 
    updateOrderStatusService, 
    processReturnRequestService, 
    updatePaymentStatusService 
} from "../../services/adminServices/orderService.js";

// ---------------------------------------------------------
//  1. ORDERS OVERVIEW (List & Filters)
// ---------------------------------------------------------
export const getOrdersPage = async (req, res) => {
    try {
        // Defaults to page 1 and a limit of 6 items for the table
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const { search, status, sort } = req.query; 

        // We pass filters and sorting directly to the service layer 
        // to handle the heavy lifting (searching/sorting) in the DB.
        const { orders, totalOrders } = await getAdminOrdersList(page, limit, search, status, sort);
        const totalPages = Math.ceil(totalOrders / limit);

        res.render("admin/orders", {
            title: "Manage Orders",
            orders,
            currentPage: page,
            totalPages,
            searchQuery: search || '',
            currentStatus: status || 'all',
            currentSort: sort || 'newest' // Keeps the dropdown synced with the current view
        });
    } catch (error) {
        console.error("Admin Orders Page Error:", error);
        res.redirect("/admin/dashboard");
    }
};

// ---------------------------------------------------------
//  2. DETAILED VIEW
// ---------------------------------------------------------
export const getAdminOrderDetailPage = async (req, res) => {
    try {
        const order = await getAdminOrderById(req.params.id);
        
        // If the ID is invalid or order was deleted, bounce them back to the list
        if (!order) {
            return res.redirect('/admin/orders');
        }

        res.render("admin/orderDetail", {
            title: `Order Details - ${order.orderId}`,
            order
        });
    } catch (error) {
        console.error("Admin Order Detail Error:", error);
        res.redirect('/admin/orders');
    }
};

// ---------------------------------------------------------
//  3. AJAX UPDATES (Quick Actions)
// ---------------------------------------------------------

/**
 * Updates the high-level order status (Processing, Shipped, etc.)
 */
export const updateOrderStatusAjax = async (req, res) => {
    try {
        const { status } = req.body;
        await updateOrderStatusService(req.params.id, status);
        
        res.json({ success: true, message: `Order status updated to ${status}.` });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Decides whether to Approve or Reject a user's return request.
 * If rejected, a reason is required to explain why to the customer.
 */
export const processReturnAjax = async (req, res) => {
    try {
        const { action, rejectReason } = req.body;
        await processReturnRequestService(req.params.orderId, req.params.itemId, action, rejectReason);
        
        res.json({ success: true, message: `Return ${action.toLowerCase()}ed successfully.` });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * Manually update payment status (Useful for COD or bank transfers)
 */
export const updatePaymentStatusAjax = async (req, res) => {
    try {
        const { status } = req.body;
        await updatePaymentStatusService(req.params.id, status);
        
        res.json({ 
            success: true, 
            message: `Payment status updated to ${status}.` 
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};