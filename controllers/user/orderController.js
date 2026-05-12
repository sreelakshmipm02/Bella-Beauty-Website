import Order from "../../models/order.js";
import {
  getUserOrders,
  getOrderById,
  cancelMultipleItemsService,
  returnMultipleItemsService,
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
    return res.redirect("/shop");
  }

  res.render("user/orderSuccess", {
    title: "Order Successful - Bella Beauty",
    isLoggedIn: true,
    order,
    paymentStatement: [
      { label: "Order ID", value: order.orderId },
      {
        label: "Payment Method",
        value:
          order.payment.method === "Online"
            ? "Razorpay"
            : order.payment.method === "Wallet"
              ? "Bella Wallet"
              : order.payment.method,
      },
      { label: "Payment Status", value: order.payment.status },
      {
        label:
          order.payment.method === "Wallet" ? "Wallet Debited" : "Amount Paid",
        value: `₹${order.summary.total.toFixed(2)}`,
      },
      ...(order.payment.transactionId
        ? [{ label: "Reference", value: order.payment.transactionId }]
        : []),
    ],
  });
});

/**
 * Show payment failure page for unsuccessful online checkout attempts.
 */
export const getPaymentFailurePage = asyncHandler(async (req, res) => {
  const message = req.query.message || "We couldn't complete your payment.";
  const code = req.query.code || "";

  res.render("user/paymentFailure", {
    title: "Payment Failed - Bella Beauty",
    isLoggedIn: true,
    message,
    code,
  });
});

/**
 * Show all orders of the user.
 * Supports simple search.
 */
export const getOrderHistoryPage = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const searchQuery = req.query.search || "";
  const orders = await getUserOrders(userId, searchQuery);

  res.render("user/orders", {
    title: "My Orders - Aura",
    isLoggedIn: true,
    orders,
    searchQuery,
  });
});

/**
 * Show details of a single order.
 */
export const getOrderDetailPage = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const order = await getOrderById(req.params.orderId, userId);

  if (!order) {
    return res.redirect("/orders");
  }

  res.render("user/orderDetail", {
    title: `Order ${order.orderId} - Aura`,
    isLoggedIn: true,
    order,
  });
});

// ---------------------------------------------------------
//  2. CANCEL ORDER / ITEM
// ---------------------------------------------------------

/**
 * Cancel full order (all items).
 */
export const cancelOrderAjax = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.orderId,
    userId: req.session.userId,
  });
  if (!order) throw new AppError("Order not found", 404);

  const allItemIds = order.items.map((item) => item._id);
  const result = await cancelMultipleItemsService(
    req.params.orderId,
    allItemIds,
    req.session.userId,
    req.body.reason,
  );

  const message =
    result.refundAmount > 0
      ? `Order cancelled successfully. ₹${result.refundAmount.toFixed(2)} has been refunded to your wallet.`
      : "Order cancelled successfully.";

  res.status(200).json({ success: true, message });
});

/**
 * Cancel a single item.
 */
export const cancelItemAjax = asyncHandler(async (req, res) => {
  const result = await cancelMultipleItemsService(
    req.params.orderId,
    [req.params.itemId],
    req.session.userId,
    req.body.reason,
  );
  const message =
    result.refundAmount > 0
      ? `Item cancelled successfully. ₹${result.refundAmount.toFixed(2)} has been refunded to your wallet.`
      : "Item cancelled successfully.";

  res.status(200).json({ success: true, message });
});

// ---------------------------------------------------------
//  3. RETURN ORDER / ITEM
// ---------------------------------------------------------

/**
 * Request return for all delivered items in an order.
 */
export const returnOrderAjax = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    _id: req.params.orderId,
    userId: req.session.userId,
  });
  if (!order) throw new AppError("Order not found", 404);

  const deliveredItemIds = order.items
    .filter((item) => item.status === "Delivered")
    .map((item) => item._id);
  if (deliveredItemIds.length === 0) {
    throw new AppError("No delivered items found to return.", 400);
  }

  await returnMultipleItemsService(
    req.params.orderId,
    deliveredItemIds,
    req.session.userId,
    req.body.reason,
  );
  res.status(200).json({
    success: true,
    message:
      "Return requested successfully. Your refund will be credited to your wallet once the admin approves it.",
  });
});

/**
 * Request return for a single item.
 */
export const returnItemAjax = asyncHandler(async (req, res) => {
  await returnMultipleItemsService(
    req.params.orderId,
    [req.params.itemId],
    req.session.userId,
    req.body.reason,
  );
  res.status(200).json({
    success: true,
    message:
      "Item return requested successfully. Your refund will be credited to your wallet once the admin approves it.",
  });
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

  if (!order || order.orderStatus !== "Delivered") {
    throw new AppError("Invoice only available for delivered orders.", 400);
  }

  const pdfBuffer = await generateInvoicePDF(order);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=Invoice-${order.orderId}.pdf`,
  );
  res.send(pdfBuffer);
});
