import crypto from "crypto";
import User from "../models/user.js";
import AppError from "../utils/AppError.js";

const toPaise = (amount) => Math.round((Number(amount) || 0) * 100);
const fromPaise = (amountInPaise) => Number((amountInPaise / 100).toFixed(2));

const buildWalletReference = (prefix) => {
  const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${Date.now()}-${randomPart}`;
};

const ensureWalletShape = (user) => {
  if (!user.wallet) {
    user.wallet = { balance: 0, transactions: [] };
  }

  if (!Array.isArray(user.wallet.transactions)) {
    user.wallet.transactions = [];
  }
};

export const recalculateOrderStatusFromItems = (items = []) => {
  const statuses = items.map((item) => item.status);

  if (statuses.length === 0) return "Pending";
  if (statuses.every((status) => status === "Cancelled")) return "Cancelled";
  if (statuses.every((status) => ["Returned", "Cancelled"].includes(status)))
    return "Returned";
  if (statuses.includes("Return Approved")) return "Return Approved";
  if (statuses.includes("Return Requested")) return "Return Requested";

  const completedStates = [
    "Delivered",
    "Returned",
    "Cancelled",
    "Return Rejected",
  ];

  if (statuses.every((status) => completedStates.includes(status)))
    return "Delivered";
  if (statuses.includes("Shipped")) return "Shipped";
  if (
    statuses.includes("Processing") ||
    statuses.includes("Delivered") ||
    statuses.includes("Return Rejected")
  ) {
    return "Processing";
  }

  return "Pending";
};

export const buildRefundAllocationMap = (order) => {
  const items = order?.items || [];
  const allocations = new Map();

  if (!items.length) {
    return allocations;
  }

  const totalRefundPaise = toPaise(order.summary?.total || 0);
  const totalItemValuePaise = items.reduce(
    (sum, item) => sum + toPaise(item.itemTotal || 0),
    0,
  );

  if (totalRefundPaise <= 0 || totalItemValuePaise <= 0) {
    items.forEach((item) => allocations.set(String(item._id), 0));
    return allocations;
  }

  const provisionalShares = items.map((item, index) => {
    const itemValuePaise = toPaise(item.itemTotal || 0);
    const rawShare = (totalRefundPaise * itemValuePaise) / totalItemValuePaise;
    const floorShare = Math.floor(rawShare);

    return {
      itemId: String(item._id),
      index,
      paise: floorShare,
      remainder: rawShare - floorShare,
    };
  });

  let allocatedPaise = provisionalShares.reduce(
    (sum, share) => sum + share.paise,
    0,
  );
  let remainingPaise = totalRefundPaise - allocatedPaise;

  provisionalShares
    .sort((a, b) => {
      if (b.remainder === a.remainder) return a.index - b.index;
      return b.remainder - a.remainder;
    })
    .forEach((share) => {
      if (remainingPaise <= 0) return;
      share.paise += 1;
      remainingPaise -= 1;
    });

  provisionalShares.forEach((share) => {
    allocations.set(share.itemId, fromPaise(share.paise));
  });

  return allocations;
};

export const getRefundAmountForItem = (order, itemId) => {
  const allocations = buildRefundAllocationMap(order);
  return Number((allocations.get(String(itemId)) || 0).toFixed(2));
};

export const canRefundToWallet = (order) => {
  const paymentStatus = order?.payment?.status;
  return Boolean(
    paymentStatus && !["Pending", "Failed"].includes(paymentStatus),
  );
};

export const syncPaymentRefundStatus = (order) => {
  const refundedAmount = fromPaise(
    toPaise(order?.payment?.refundedAmount || 0),
  );
  const totalPaid = fromPaise(toPaise(order?.summary?.total || 0));

  order.payment.refundedAmount = refundedAmount;

  if (refundedAmount <= 0) {
    return;
  }

  order.payment.status =
    refundedAmount >= totalPaid ? "Refunded" : "Partially Refunded";
};

export const creditWallet = async ({
  userId,
  amount,
  description,
  orderId = null,
  itemId = null,
}) => {
  const normalizedAmount = fromPaise(toPaise(amount));

  if (normalizedAmount <= 0) {
    return null;
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found for wallet credit.", 404);
  }

  ensureWalletShape(user);

  const updatedBalance = fromPaise(
    toPaise(user.wallet.balance || 0) + toPaise(normalizedAmount),
  );
  const transaction = {
    type: "credit",
    amount: normalizedAmount,
    balanceAfter: updatedBalance,
    description,
    orderId,
    itemId,
    reference: buildWalletReference("WCR"),
  };

  user.wallet.balance = updatedBalance;
  user.wallet.transactions.unshift(transaction);

  await user.save();

  return transaction;
};

export const debitWallet = async ({
  userId,
  amount,
  description,
  orderId = null,
}) => {
  const normalizedAmount = fromPaise(toPaise(amount));

  if (normalizedAmount <= 0) {
    return null;
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found for wallet payment.", 404);
  }

  ensureWalletShape(user);

  const currentBalance = fromPaise(toPaise(user.wallet.balance || 0));

  if (currentBalance < normalizedAmount) {
    throw new AppError("Insufficient wallet balance for this payment.", 400);
  }

  const updatedBalance = fromPaise(
    toPaise(currentBalance) - toPaise(normalizedAmount),
  );
  const transaction = {
    type: "debit",
    amount: normalizedAmount,
    balanceAfter: updatedBalance,
    description,
    orderId,
    reference: buildWalletReference("WDB"),
  };

  user.wallet.balance = updatedBalance;
  user.wallet.transactions.unshift(transaction);

  await user.save();

  return transaction;
};

export const getWalletSnapshot = async (userId, transactionLimit = 8) => {
  const user = await User.findById(userId).select("wallet");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  ensureWalletShape(user);

  const transactions = [...user.wallet.transactions].sort(
    (left, right) => new Date(right.createdAt) - new Date(left.createdAt),
  );

  return {
    balance: fromPaise(toPaise(user.wallet.balance || 0)),
    transactions:
      transactionLimit > 0
        ? transactions.slice(0, transactionLimit)
        : transactions,
  };
};
