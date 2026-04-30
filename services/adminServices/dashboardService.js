import Order from "../../models/order.js";
import User from "../../models/user.js";
import ProductVariant from "../../models/productVariant.js";
import { getSalesAnalytics } from "./analyticsService.js";

/**
 * Fetches dynamic dashboard data for both operational monitoring and sales insights.
 */
export const getDashboardMetrics = async ({ period = "weekly", from = "", to = "" } = {}) => {
    const [
        analytics,
        revenueAggregation,
        totalOrders,
        activeUsers,
        pendingOrdersCount,
        lowStockCount,
        recentOrders
    ] = await Promise.all([
        getSalesAnalytics({ period, from, to }),
        Order.aggregate([
            { $match: { orderStatus: { $nin: ["Cancelled", "Returned"] } } },
            { $group: { _id: null, totalRevenue: { $sum: "$summary.total" } } }
        ]),
        Order.countDocuments(),
        User.countDocuments({ status: { $ne: "suspended" } }),
        Order.countDocuments({ orderStatus: "Pending" }),
        ProductVariant.countDocuments({ status: "active", stock: { $lt: 10 } }),
        Order.find()
            .populate("userId", "firstName lastName")
            .sort({ createdAt: -1 })
            .limit(5)
            .lean()
    ]);

    const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].totalRevenue : 0;

    return {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalOrders,
        activeUsers,
        pendingOrdersCount,
        lowStockCount,
        recentOrders,
        filters: analytics.filters,
        periodSummary: analytics.summary,
        salesTrend: analytics.salesTrend,
        orderStatusDistribution: analytics.orderStatusDistribution,
        paymentMethodDistribution: analytics.paymentMethodDistribution,
        topProducts: analytics.topProducts,
        recentSalesRows: analytics.recentOrders
    };
};
