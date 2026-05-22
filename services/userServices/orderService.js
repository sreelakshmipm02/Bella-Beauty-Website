import "../../config/env.js";
import crypto from "crypto";
import Razorpay from "razorpay";
import Order from "../../models/order.js";
import Cart from "../../models/cart.js";
import Coupon from "../../models/coupon.js";
import ProductVariant from "../../models/productVariant.js";
import { getCartData } from "./cartService.js";
import { getAddressById } from "./userAddress.js";
import {
  buildRefundAllocationMap,
  canRefundToWallet,
  creditWallet,
  debitWallet,
  recalculateOrderStatusFromItems,
  syncPaymentRefundStatus,
} from "../walletService.js";
import AppError from "../../utils/AppError.js";

let razorpayInstance;

const EMPTY_COUPON = {
  couponId: null,
  code: null,
  discountAmount: 0,
};

export const getRazorpayInstance = () => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new AppError(
      "Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      500,
    );
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }

  return razorpayInstance;
};

// Securely verify payment signature
export const verifyPaymentSignature = (
  razorpayOrderId,
  razorpayPaymentId,
  signature,
) => {
  const body = razorpayOrderId + "|" + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  return expectedSignature === signature;
};

const ensureValidPaymentMethod = (paymentMethod) => {
  if (!["COD", "Online", "Wallet"].includes(paymentMethod)) {
    throw new AppError("Invalid payment method selected.", 400);
  }
};

const ensureCheckoutStock = async (cartItems) => {
  for (const item of cartItems) {
    const variant = await ProductVariant.findById(item.variantId).select(
      "stock status",
    );

    if (!variant || variant.status !== "active") {
      throw new AppError(`${item.productName} is no longer available.`, 409);
    }

    if (variant.stock < item.quantity) {
      throw new AppError(
        `${item.productName} only has ${variant.stock} item(s) left in stock.`,
        409,
      );
    }
  }
};

const clearCartAfterCheckout = async (userId) => {
  await Cart.findOneAndUpdate(
    { userId },
    {
      $set: {
        items: [],
        appliedCoupon: { ...EMPTY_COUPON },
      },
    },
  );
};

const removeOrderItemsFromCart = async (userId, orderItems) => {
  const variantIds = orderItems.map((item) => item.productVariantId.toString());

  await Cart.findOneAndUpdate(
    { userId },
    {
      $pull: {
        items: {
          productVariantId: { $in: variantIds },
        },
      },
      $set: {
        appliedCoupon: { ...EMPTY_COUPON },
      },
    },
  );
};

const getCouponSnapshot = async (cartRecord, cartData) => {
  if (!cartRecord?.appliedCoupon?.couponId && !cartData.appliedCoupon?.code) {
    return null;
  }

  const coupon = cartRecord?.appliedCoupon?.couponId
    ? await Coupon.findById(cartRecord.appliedCoupon.couponId).select(
        "code discountType",
      )
    : await Coupon.findOne({ code: cartData.appliedCoupon.code }).select(
        "code discountType",
      );

  return {
    _id: coupon?._id || cartRecord?.appliedCoupon?.couponId || null,
    code: coupon?.code || cartData.appliedCoupon?.code || null,
    discountType: coupon?.discountType || null,
    discountAmount: Number(
      cartData.appliedCoupon?.discountAmount || cartData.summary.discount || 0,
    ),
  };
};

const buildOrderItems = (cartData) =>
  cartData.items.map((item) => ({
    productVariantId: item.variantId,
    productName: item.productName,
    image: item.image,
    price: Number(item.price),
    originalPrice: Number(item.originalPrice || item.price),
    quantity: item.quantity,
    itemTotal: Number(item.itemTotal),
    originalItemTotal: Number(item.originalItemTotal || item.itemTotal),
    offerDiscount: Number(item.offerDiscount || 0),
    appliedOffer: item.appliedOffer
      ? {
          offerId: item.appliedOffer._id || null,
          offerName: item.appliedOffer.offerName || null,
          offerType: item.appliedOffer.offerType || null,
          discountType: item.appliedOffer.discountType || null,
          discountValue: Number(item.appliedOffer.discountValue || 0),
          maxDiscountValue: Number(item.appliedOffer.maxDiscountValue || 0),
          label: item.appliedOffer.label || null,
        }
      : undefined,
    status: "Pending",
    refund: {
      status: "None",
      amount: 0,
    },
  }));

const buildOrderDocument = ({
  userId,
  address,
  cartData,
  couponSnapshot,
  paymentMethod,
  paymentStatus,
  transactionId = null,
}) => {
  const totalAmount = Number(cartData.summary.total);

  return new Order({
    userId,
    items: buildOrderItems(cartData),
    shippingAddress: {
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    },
    payment: {
      method: paymentMethod,
      status: paymentStatus,
      transactionId,
      walletAmount: paymentMethod === "Wallet" ? totalAmount : 0,
      refundedAmount: 0,
    },
    summary: {
      subtotal: Number(cartData.summary.subtotal),
      tax: Number(cartData.summary.tax),
      shipping: Number(cartData.summary.shipping),
      grossSubtotal: Number(cartData.summary.grossSubtotal || 0),
      originalGrossSubtotal: Number(
        cartData.summary.originalGrossSubtotal || 0,
      ),
      offerDiscount: Number(cartData.summary.offerSavings || 0),
      discount: Number(cartData.summary.discount),
      couponDiscount: Number(
        couponSnapshot?.discountAmount || cartData.summary.discount || 0,
      ),
      totalDiscount: Number(cartData.summary.totalDiscount || 0),
      couponCode: couponSnapshot?.code || undefined,
      couponDiscountType: couponSnapshot?.discountType || undefined,
      couponId: couponSnapshot?._id || undefined,
      total: totalAmount,
    },
    orderStatus: "Pending",
  });
};

const ensureOrderItemsAvailable = async (orderItems) => {
  for (const item of orderItems) {
    const variant = await ProductVariant.findById(item.productVariantId)
      .populate({
        path: "productId",
        populate: { path: "categoryId" },
      })
      .select("stock status productId");

    const product = variant?.productId;
    const category = product?.categoryId;

    if (
      !variant ||
      variant.status !== "active" ||
      !product ||
      product.status !== "active" ||
      !category ||
      category.status !== "active"
    ) {
      throw new AppError(`${item.productName} is no longer available.`, 409);
    }

    if (variant.stock < item.quantity) {
      throw new AppError(
        `${item.productName} only has ${variant.stock} item(s) left in stock.`,
        409,
      );
    }
  }
};

export const createPendingOnlineOrder = async (
  userId,
  addressId,
  razorpayOrderId = null,
) => {
  const cartData = await getCartData(userId);
  const cartRecord = await Cart.findOne({ userId }).select("appliedCoupon");

  if (!cartData || cartData.items.length === 0) {
    throw new AppError("Your cart is empty.", 400);
  }

  const address = await getAddressById(addressId, userId);

  if (!address) {
    throw new AppError("Shipping address not found.", 404);
  }

  await ensureCheckoutStock(cartData.items);

  const couponSnapshot = await getCouponSnapshot(cartRecord, cartData);
  const order = buildOrderDocument({
    userId,
    address,
    cartData,
    couponSnapshot,
    paymentMethod: "Online",
    paymentStatus: "Failed",
    transactionId: razorpayOrderId,
  });

  return await order.save();
};

export const prepareRetryOnlinePayment = async (userId, orderId) => {
  const order = await Order.findOne({ _id: orderId, userId });

  if (!order) throw new AppError("Order not found.", 404);

  if (order.payment.method !== "Online" || order.payment.status !== "Failed") {
    throw new AppError("This order is not eligible for payment retry.", 400);
  }

  if (["Cancelled", "Returned"].includes(order.orderStatus)) {
    throw new AppError("This order can no longer be paid for.", 400);
  }

  await ensureOrderItemsAvailable(order.items);

  const options = {
    amount: Math.round(Number(order.summary.total) * 100),
    currency: "INR",
    receipt: `retry_${order.orderId}_${Date.now()}`,
  };
  const razorpayOrder = await getRazorpayInstance().orders.create(options);

  order.payment.transactionId = razorpayOrder.id;
  await order.save();

  return {
    order,
    razorpayOrder,
    amount: options.amount,
    key: process.env.RAZORPAY_KEY_ID,
  };
};

export const finalizeOnlineOrderPayment = async (
  userId,
  orderId,
  transactionId,
) => {
  const order = await Order.findOne({ _id: orderId, userId });

  if (!order) throw new AppError("Order not found.", 404);

  if (order.payment.method !== "Online") {
    throw new AppError("This order was not placed with online payment.", 400);
  }

  if (order.payment.status === "Paid") {
    return order;
  }

  await ensureOrderItemsAvailable(order.items);

  const stockAdjustments = [];

  try {
    for (const item of order.items) {
      const updatedVariant = await ProductVariant.findOneAndUpdate(
        {
          _id: item.productVariantId,
          status: "active",
          stock: { $gte: item.quantity },
        },
        { $inc: { stock: -item.quantity } },
        { new: true },
      );

      if (!updatedVariant) {
        throw new AppError(
          `Sorry, ${item.productName} is no longer available in the requested quantity.`,
          409,
        );
      }

      stockAdjustments.push({
        variantId: item.productVariantId,
        quantity: item.quantity,
      });
    }

    order.payment.status = "Paid";
    order.payment.transactionId = transactionId;
    await order.save();
    await removeOrderItemsFromCart(userId, order.items);

    return order;
  } catch (error) {
    if (stockAdjustments.length > 0) {
      await Promise.all(
        stockAdjustments.map((adjustment) =>
          ProductVariant.findByIdAndUpdate(adjustment.variantId, {
            $inc: { stock: adjustment.quantity },
          }),
        ),
      );
    }

    throw error;
  }
};

// -------------------------------
// 1. CHECKOUT
// -------------------------------

// This function converts cart into an order
export const processCheckout = async (
  userId,
  addressId,
  paymentMethod,
  transactionId = null,
) => {
  ensureValidPaymentMethod(paymentMethod);

  const cartData = await getCartData(userId);
  const cartRecord = await Cart.findOne({ userId }).select("appliedCoupon");

  if (!cartData || cartData.items.length === 0) {
    throw new AppError("Your cart is empty.", 400);
  }

  const address = await getAddressById(addressId, userId);

  if (!address) {
    throw new AppError("Shipping address not found.", 404);
  }

  await ensureCheckoutStock(cartData.items);

  let couponSnapshot = null;

  if (cartRecord?.appliedCoupon?.couponId || cartData.appliedCoupon?.code) {
    const coupon = cartRecord?.appliedCoupon?.couponId
      ? await Coupon.findById(cartRecord.appliedCoupon.couponId).select(
          "code discountType",
        )
      : await Coupon.findOne({ code: cartData.appliedCoupon.code }).select(
          "code discountType",
        );

    couponSnapshot = {
      _id: coupon?._id || cartRecord?.appliedCoupon?.couponId || null,
      code: coupon?.code || cartData.appliedCoupon?.code || null,
      discountType: coupon?.discountType || null,
      discountAmount: Number(
        cartData.appliedCoupon?.discountAmount ||
          cartData.summary.discount ||
          0,
      ),
    };
  }

  const orderItems = cartData.items.map((item) => ({
    productVariantId: item.variantId,
    productName: item.productName,
    image: item.image,
    price: Number(item.price),
    originalPrice: Number(item.originalPrice || item.price),
    quantity: item.quantity,
    itemTotal: Number(item.itemTotal),
    originalItemTotal: Number(item.originalItemTotal || item.itemTotal),
    offerDiscount: Number(item.offerDiscount || 0),
    appliedOffer: item.appliedOffer
      ? {
          offerId: item.appliedOffer._id || null,
          offerName: item.appliedOffer.offerName || null,
          offerType: item.appliedOffer.offerType || null,
          discountType: item.appliedOffer.discountType || null,
          discountValue: Number(item.appliedOffer.discountValue || 0),
          maxDiscountValue: Number(item.appliedOffer.maxDiscountValue || 0),
          label: item.appliedOffer.label || null,
        }
      : undefined,
    status: "Pending",
    refund: {
      status: "None",
      amount: 0,
    },
  }));

  const totalAmount = Number(cartData.summary.total);
  const newOrder = new Order({
    userId,
    items: orderItems,
    shippingAddress: {
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    },
    payment: {
      method: paymentMethod,
      status: paymentMethod === "COD" ? "Pending" : "Paid",
      transactionId,
      walletAmount: paymentMethod === "Wallet" ? totalAmount : 0,
      refundedAmount: 0,
    },
    summary: {
      subtotal: Number(cartData.summary.subtotal),
      tax: Number(cartData.summary.tax),
      shipping: Number(cartData.summary.shipping),
      grossSubtotal: Number(cartData.summary.grossSubtotal || 0),
      originalGrossSubtotal: Number(
        cartData.summary.originalGrossSubtotal || 0,
      ),
      offerDiscount: Number(cartData.summary.offerSavings || 0),
      discount: Number(cartData.summary.discount),
      couponDiscount: Number(
        couponSnapshot?.discountAmount || cartData.summary.discount || 0,
      ),
      totalDiscount: Number(cartData.summary.totalDiscount || 0),
      couponCode: couponSnapshot?.code || undefined,
      couponDiscountType: couponSnapshot?.discountType || undefined,
      couponId: couponSnapshot?._id || undefined,
      total: totalAmount,
    },
    orderStatus: "Pending",
  });

  const stockAdjustments = [];
  let walletDebitTransaction = null;

  try {
    if (paymentMethod === "Wallet") {
      walletDebitTransaction = await debitWallet({
        userId,
        amount: totalAmount,
        description: `Wallet payment for order ${newOrder.orderId}`,
        orderId: newOrder._id,
      });

      newOrder.payment.transactionId = walletDebitTransaction.reference;
    }

    const savedOrder = await newOrder.save();

    for (const item of cartData.items) {
      const updatedVariant = await ProductVariant.findOneAndUpdate(
        {
          _id: item.variantId,
          stock: { $gte: item.quantity },
        },
        { $inc: { stock: -item.quantity } },
        { new: true },
      );

      if (!updatedVariant) {
        throw new AppError(
          `Sorry, ${item.productName} is no longer available in the requested quantity.`,
          409,
        );
      }

      stockAdjustments.push({
        variantId: item.variantId,
        quantity: item.quantity,
      });
    }

    await clearCartAfterCheckout(userId);

    return savedOrder;
  } catch (error) {
    if (stockAdjustments.length > 0) {
      await Promise.all(
        stockAdjustments.map((adjustment) =>
          ProductVariant.findByIdAndUpdate(adjustment.variantId, {
            $inc: { stock: adjustment.quantity },
          }),
        ),
      );
    }

    await Order.findByIdAndDelete(newOrder._id);

    if (walletDebitTransaction) {
      await creditWallet({
        userId,
        amount: totalAmount,
        description: `Wallet reversal for failed checkout ${newOrder.orderId}`,
        orderId: newOrder._id,
      });
    }

    throw error;
  }
};

// -------------------------------
// 2. GET ORDERS
// -------------------------------

// Get all orders of a user (with optional search)
export const getUserOrders = async (userId, searchQuery = "") => {
  const query = { userId };

  if (searchQuery) {
    query.$or = [
      { orderId: { $regex: searchQuery, $options: "i" } },
      { "items.productName": { $regex: searchQuery, $options: "i" } },
    ];
  }

  return await Order.find(query).sort({ createdAt: -1 });
};

// Get single order by ID
export const getOrderById = async (orderId, userId) => {
  return await Order.findOne({ _id: orderId, userId }).populate(
    "items.productVariantId",
  );
};

// -------------------------------
// 3. CANCEL ITEMS
// -------------------------------

// Cancel selected items in an order
export const cancelMultipleItemsService = async (
  orderId,
  itemIds,
  userId,
  reason,
) => {
  const order = await Order.findOne({ _id: orderId, userId });

  if (!order) throw new AppError("Order not found", 404);

  if (order.orderStatus === "Shipped" || order.orderStatus === "Delivered") {
    throw new AppError("Cannot cancel items after shipping.", 400);
  }

  const refundAllocations = buildRefundAllocationMap(order);
  const refundableItems = [];
  let totalRefundAmount = 0;
  const shouldRestoreStock = order.payment?.status !== "Failed";

  for (const itemId of itemIds) {
    const item = order.items.id(itemId);

    if (!item || item.status === "Cancelled") {
      continue;
    }

    if (shouldRestoreStock) {
      await ProductVariant.findByIdAndUpdate(item.productVariantId, {
        $inc: { stock: item.quantity },
      });
    }

    item.status = "Cancelled";
    item.cancelReason = reason;

    if (canRefundToWallet(order) && item.refund?.status !== "Processed") {
      const refundAmount = Number(
        (refundAllocations.get(String(item._id)) || 0).toFixed(2),
      );

      if (refundAmount > 0) {
        refundableItems.push({ item, refundAmount });
        totalRefundAmount += refundAmount;
      }
    }
  }

  order.orderStatus = recalculateOrderStatusFromItems(order.items);

  if (order.orderStatus === "Cancelled") {
    order.cancelReason = reason || "Cancelled by user";
  }

  if (refundableItems.length > 0) {
    const walletTransaction = await creditWallet({
      userId,
      amount: totalRefundAmount,
      description:
        order.orderStatus === "Cancelled"
          ? `Refund for cancelled order ${order.orderId}`
          : `Refund for cancelled item(s) in order ${order.orderId}`,
      orderId: order._id,
    });

    refundableItems.forEach(({ item, refundAmount }) => {
      item.refund = item.refund || {};
      item.refund.status = "Processed";
      item.refund.amount = refundAmount;
      item.refund.trigger = "Cancellation";
      item.refund.processedAt = new Date();
      item.refund.transactionReference = walletTransaction.reference;
    });

    order.payment.refundedAmount = Number(
      (Number(order.payment.refundedAmount || 0) + totalRefundAmount).toFixed(
        2,
      ),
    );
    syncPaymentRefundStatus(order);
  }

  await order.save();

  return {
    order,
    refundAmount: Number(totalRefundAmount.toFixed(2)),
  };
};

// -------------------------------
// 4. RETURN ITEMS
// -------------------------------

// Request return for items
export const returnMultipleItemsService = async (
  orderId,
  itemIds,
  userId,
  reason,
) => {
  const order = await Order.findOne({ _id: orderId, userId });

  if (!order) throw new AppError("Order not found", 404);

  if (order.orderStatus !== "Delivered" && order.orderStatus !== "Returned") {
    throw new AppError("Only delivered orders can be returned.", 400);
  }

  const deliveryDate = new Date(order.updatedAt);
  const diffInDays = (new Date() - deliveryDate) / (1000 * 3600 * 24);

  if (diffInDays > 10) {
    throw new AppError("Return allowed only within 10 days.", 400);
  }

  for (const itemId of itemIds) {
    const item = order.items.id(itemId);

    if (item && item.status === "Delivered") {
      item.status = "Return Requested";
      item.cancelReason = reason;
      item.refund = item.refund || {};
      item.refund.status = canRefundToWallet(order) ? "Pending" : "None";
      item.refund.amount = 0;
      item.refund.trigger = canRefundToWallet(order) ? "Return" : "";
      item.refund.processedAt = undefined;
      item.refund.transactionReference = undefined;
    }
  }

  order.orderStatus = recalculateOrderStatusFromItems(order.items);

  if (order.orderStatus === "Returned") {
    order.returnReason = "Returned by user";
  }

  await order.save();

  return order;
};
