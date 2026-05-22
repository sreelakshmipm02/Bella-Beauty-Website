import Order from "../../models/order.js";
import ProductVariant from "../../models/productVariant.js";
import {
  buildRefundAllocationMap,
  canRefundToWallet,
  creditWallet,
  recalculateOrderStatusFromItems,
  syncPaymentRefundStatus,
} from "../walletService.js";
import AppError from "../../utils/AppError.js";

// Order status should follow this step-by-step flow
const MANUAL_STATUS_FLOW = ["Pending", "Processing", "Shipped", "Delivered"];
export const ORDER_NOT_PLACED_STATUS = "Order Not Placed";

export const isOrderNotPlaced = (order = {}) =>
  order?.payment?.status === "Failed";

export const getAdminOrderDisplayStatus = (order = {}) =>
  isOrderNotPlaced(order)
    ? ORDER_NOT_PLACED_STATUS
    : order?.orderStatus || "Pending";

const buildAdminStatusFilterQuery = (statusFilter = "all") => {
  if (!statusFilter || statusFilter === "all") return {};

  if (statusFilter === ORDER_NOT_PLACED_STATUS) {
    return { "payment.status": "Failed" };
  }

  if (statusFilter === "Pending") {
    return {
      orderStatus: "Pending",
      "payment.status": { $ne: "Failed" },
    };
  }

  return { orderStatus: statusFilter };
};

export const getAdminOrdersList = async (
  page = 1,
  limit = 6,
  search = "",
  statusFilter = "all",
  sortOption = "newest",
) => {
  const query = {};

  if (search) query.orderId = { $regex: search, $options: "i" };
  Object.assign(query, buildAdminStatusFilterQuery(statusFilter));

  let sortQuery = { createdAt: -1 };

  if (sortOption === "oldest") sortQuery = { createdAt: 1 };
  if (sortOption === "amount_desc") sortQuery = { "summary.total": -1 };
  if (sortOption === "amount_asc") sortQuery = { "summary.total": 1 };

  const skip = (page - 1) * limit;

  const orders = await Order.find(query)
    .populate("userId", "firstName lastName email phone")
    .sort(sortQuery)
    .skip(skip)
    .limit(limit);

  const totalOrders = await Order.countDocuments(query);

  return { orders, totalOrders };
};

export const getAdminOrderById = async (orderId) => {
  return await Order.findById(orderId)
    .populate("userId", "firstName lastName email phone")
    .populate("items.productVariantId");
};

export const updateOrderStatusService = async (orderId, newStatus) => {
  const order = await Order.findById(orderId);

  if (!order) throw new AppError("Order not found", 404);
  if (isOrderNotPlaced(order)) {
    throw new AppError(
      "This order was not placed because the payment failed.",
      400,
    );
  }

  const currentIdx = MANUAL_STATUS_FLOW.indexOf(order.orderStatus);
  const newIdx = MANUAL_STATUS_FLOW.indexOf(newStatus);

  if (
    currentIdx !== -1 &&
    newIdx !== -1 &&
    newIdx <= currentIdx &&
    newStatus !== order.orderStatus
  ) {
    throw new AppError(
      `Cannot revert status from ${order.orderStatus} to ${newStatus}`,
      400,
    );
  }

  if (newStatus === "Returned") {
    const approvedItems = order.items.filter(
      (item) => item.status === "Return Approved",
    );

    if (approvedItems.length === 0) {
      throw new AppError(
        "Cannot set to Returned unless a return request has been approved.",
        400,
      );
    }

    for (const item of approvedItems) {
      item.status = "Returned";

      await ProductVariant.findByIdAndUpdate(item.productVariantId, {
        $inc: { stock: item.quantity },
      });
    }

    order.orderStatus = recalculateOrderStatusFromItems(order.items);
  } else {
    order.items.forEach((item) => {
      if (
        ![
          "Cancelled",
          "Returned",
          "Return Requested",
          "Return Approved",
          "Return Rejected",
        ].includes(item.status)
      ) {
        item.status = newStatus;
      }
    });

    order.orderStatus = newStatus;
  }

  if (newStatus === "Delivered" && order.payment.status === "Pending") {
    order.payment.status = "Paid";
  }

  await order.save();
  return order;
};

export const updatePaymentStatusService = async (orderId, newStatus) => {
  const order = await Order.findById(orderId);

  if (!order) throw new AppError("Order not found", 404);

  if (
    ["Refunded", "Partially Refunded"].includes(order.payment.status) ||
    Number(order.payment.refundedAmount || 0) > 0
  ) {
    throw new AppError(
      "Cannot manually change payment status after a wallet refund has been recorded.",
      400,
    );
  }

  order.payment.status = newStatus;

  await order.save();
  return order;
};

export const processReturnRequestService = async (
  orderId,
  itemId,
  action,
  rejectReason,
) => {
  const order = await Order.findById(orderId);

  if (!order) throw new AppError("Order not found", 404);

  const item = order.items.id(itemId);

  if (!item || item.status !== "Return Requested") {
    throw new AppError("Item is not pending a return request.", 400);
  }

  let refundAmount = 0;

  if (action === "Approve") {
    item.status = "Returned";

    await ProductVariant.findByIdAndUpdate(item.productVariantId, {
      $inc: { stock: item.quantity },
    });

    if (canRefundToWallet(order) && item.refund?.status !== "Processed") {
      const refundAllocations = buildRefundAllocationMap(order);
      refundAmount = Number(
        (refundAllocations.get(String(item._id)) || 0).toFixed(2),
      );

      if (refundAmount > 0) {
        const walletTransaction = await creditWallet({
          userId: order.userId,
          amount: refundAmount,
          description: `Refund for approved return in order ${order.orderId}`,
          orderId: order._id,
          itemId: item._id,
        });

        item.refund = item.refund || {};
        item.refund.status = "Processed";
        item.refund.amount = refundAmount;
        item.refund.trigger = "Return";
        item.refund.processedAt = new Date();
        item.refund.transactionReference = walletTransaction.reference;

        order.payment.refundedAmount = Number(
          (Number(order.payment.refundedAmount || 0) + refundAmount).toFixed(2),
        );
        syncPaymentRefundStatus(order);
      }
    }

    if (!refundAmount) {
      item.refund = item.refund || {};
      item.refund.status = canRefundToWallet(order) ? "Processed" : "None";
      item.refund.amount = refundAmount;
      item.refund.trigger = "Return";
      item.refund.processedAt = canRefundToWallet(order)
        ? new Date()
        : undefined;
      item.refund.transactionReference = undefined;
    }
  } else if (action === "Reject") {
    item.status = "Return Rejected";
    item.adminRejectReason = rejectReason;
    item.refund = item.refund || {};
    item.refund.status = "None";
    item.refund.amount = 0;
    item.refund.trigger = "";
    item.refund.processedAt = undefined;
    item.refund.transactionReference = undefined;
  } else {
    throw new AppError("Invalid return action.", 400);
  }

  order.orderStatus = recalculateOrderStatusFromItems(order.items);

  await order.save();

  return {
    order,
    refundAmount: Number(refundAmount.toFixed(2)),
  };
};
