import { 
    getAdminOrdersList, 
    getAdminOrderById, 
    updateOrderStatusService, 
    processReturnRequestService, 
    updatePaymentStatusService 
} from "../../services/adminServices/orderService.js";

export const getOrdersPage = async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Admin Orders Page Error:", error);
        res.redirect("/admin/dashboard");
    }
};

export const getAdminOrderDetailPage = async (req, res) => {
    try {
        const order = await getAdminOrderById(req.params.id);
        if (!order) return res.redirect('/admin/orders');

        res.render("admin/orderDetail", {
            title: `Order Details - ${order.orderId}`,
            order
        });
    } catch (error) {
        console.error("Admin Order Detail Error:", error);
        res.redirect('/admin/orders');
    }
};

export const updateOrderStatusAjax = async (req, res) => {
    try {
        const { status } = req.body;
        await updateOrderStatusService(req.params.id, status);
        res.json({ success: true, message: `Order status updated to ${status}.` });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const processReturnAjax = async (req, res) => {
    try {
        const { action, rejectReason } = req.body;
        await processReturnRequestService(req.params.orderId, req.params.itemId, action, rejectReason);
        res.json({ success: true, message: `Return ${action.toLowerCase()}ed successfully.` });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const updatePaymentStatusAjax = async (req, res) => {
    try {
        const { status } = req.body;
        await updatePaymentStatusService(req.params.id, status);
        res.json({ success: true, message: `Payment status updated to ${status}.` });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};