import "../../config/env.js";
import crypto from "crypto";
import Razorpay from "razorpay";
import Order from "../../models/order.js";
import Cart from "../../models/cart.js";
import ProductVariant from "../../models/productVariant.js";
import { getCartData } from "./cartService.js";
import { getAddressById } from "./userAddress.js";
import {
    buildRefundAllocationMap,
    canRefundToWallet,
    creditWallet,
    debitWallet,
    recalculateOrderStatusFromItems,
    syncPaymentRefundStatus
} from "../walletService.js";
import AppError from "../../utils/AppError.js";

let razorpayInstance;

const EMPTY_COUPON = {
    couponId: null,
    code: null,
    discountAmount: 0
};

export const getRazorpayInstance = () => {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        throw new AppError(
            "Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
            500
        );
    }

    if (!razorpayInstance) {
        razorpayInstance = new Razorpay({
            key_id: RAZORPAY_KEY_ID,
            key_secret: RAZORPAY_KEY_SECRET
        });
    }

    return razorpayInstance;
};

// Securely verify payment signature
export const verifyPaymentSignature = (razorpayOrderId, razorpayPaymentId, signature) => {
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
        const variant = await ProductVariant.findById(item.variantId).select("stock status");

        if (!variant || variant.status !== "active") {
            throw new AppError(`${item.productName} is no longer available.`, 409);
        }

        if (variant.stock < item.quantity) {
            throw new AppError(
                `${item.productName} only has ${variant.stock} item(s) left in stock.`,
                409
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
                appliedCoupon: { ...EMPTY_COUPON }
            }
        }
    );
};

// -------------------------------
// 1. CHECKOUT
// -------------------------------

// This function converts cart into an order
export const processCheckout = async (userId, addressId, paymentMethod, transactionId = null) => {
    ensureValidPaymentMethod(paymentMethod);

    const cartData = await getCartData(userId);

    if (!cartData || cartData.items.length === 0) {
        throw new AppError("Your cart is empty.", 400);
    }

    const address = await getAddressById(addressId, userId);

    if (!address) {
        throw new AppError("Shipping address not found.", 404);
    }

    await ensureCheckoutStock(cartData.items);

    const orderItems = cartData.items.map((item) => ({
        productVariantId: item.variantId,
        productName: item.productName,
        image: item.image,
        price: Number(item.price),
        quantity: item.quantity,
        itemTotal: Number(item.itemTotal),
        status: "Pending",
        refund: {
            status: "None",
            amount: 0
        }
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
            country: address.country
        },
        payment: {
            method: paymentMethod,
            status: paymentMethod === "COD" ? "Pending" : "Paid",
            transactionId,
            walletAmount: paymentMethod === "Wallet" ? totalAmount : 0,
            refundedAmount: 0
        },
        summary: {
            subtotal: Number(cartData.summary.subtotal),
            tax: Number(cartData.summary.tax),
            shipping: Number(cartData.summary.shipping),
            discount: Number(cartData.summary.discount),
            total: totalAmount
        },
        orderStatus: "Pending"
    });

    const stockAdjustments = [];
    let walletDebitTransaction = null;

    try {
        if (paymentMethod === "Wallet") {
            walletDebitTransaction = await debitWallet({
                userId,
                amount: totalAmount,
                description: `Wallet payment for order ${newOrder.orderId}`,
                orderId: newOrder._id
            });

            newOrder.payment.transactionId = walletDebitTransaction.reference;
        }

        const savedOrder = await newOrder.save();

        for (const item of cartData.items) {
            const updatedVariant = await ProductVariant.findOneAndUpdate(
                {
                    _id: item.variantId,
                    stock: { $gte: item.quantity }
                },
                { $inc: { stock: -item.quantity } },
                { new: true }
            );

            if (!updatedVariant) {
                throw new AppError(
                    `Sorry, ${item.productName} is no longer available in the requested quantity.`,
                    409
                );
            }

            stockAdjustments.push({
                variantId: item.variantId,
                quantity: item.quantity
            });
        }

        await clearCartAfterCheckout(userId);

        return savedOrder;
    } catch (error) {
        if (stockAdjustments.length > 0) {
            await Promise.all(
                stockAdjustments.map((adjustment) =>
                    ProductVariant.findByIdAndUpdate(adjustment.variantId, {
                        $inc: { stock: adjustment.quantity }
                    })
                )
            );
        }

        await Order.findByIdAndDelete(newOrder._id);

        if (walletDebitTransaction) {
            await creditWallet({
                userId,
                amount: totalAmount,
                description: `Wallet reversal for failed checkout ${newOrder.orderId}`,
                orderId: newOrder._id
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
            { "items.productName": { $regex: searchQuery, $options: "i" } }
        ];
    }

    return await Order.find(query).sort({ createdAt: -1 });
};

// Get single order by ID
export const getOrderById = async (orderId, userId) => {
    return await Order.findOne({ _id: orderId, userId })
        .populate("items.productVariantId");
};

// -------------------------------
// 3. CANCEL ITEMS
// -------------------------------

// Cancel selected items in an order
export const cancelMultipleItemsService = async (orderId, itemIds, userId, reason) => {
    const order = await Order.findOne({ _id: orderId, userId });

    if (!order) throw new AppError("Order not found", 404);

    if (order.orderStatus === "Shipped" || order.orderStatus === "Delivered") {
        throw new AppError("Cannot cancel items after shipping.", 400);
    }

    const refundAllocations = buildRefundAllocationMap(order);
    const refundableItems = [];
    let totalRefundAmount = 0;

    for (const itemId of itemIds) {
        const item = order.items.id(itemId);

        if (!item || item.status === "Cancelled") {
            continue;
        }

        await ProductVariant.findByIdAndUpdate(
            item.productVariantId,
            { $inc: { stock: item.quantity } }
        );

        item.status = "Cancelled";
        item.cancelReason = reason;

        if (canRefundToWallet(order) && item.refund?.status !== "Processed") {
            const refundAmount = Number((refundAllocations.get(String(item._id)) || 0).toFixed(2));

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
            description: order.orderStatus === "Cancelled"
                ? `Refund for cancelled order ${order.orderId}`
                : `Refund for cancelled item(s) in order ${order.orderId}`,
            orderId: order._id
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
            (Number(order.payment.refundedAmount || 0) + totalRefundAmount).toFixed(2)
        );
        syncPaymentRefundStatus(order);
    }

    await order.save();

    return {
        order,
        refundAmount: Number(totalRefundAmount.toFixed(2))
    };
};

// -------------------------------
// 4. RETURN ITEMS
// -------------------------------

// Request return for items
export const returnMultipleItemsService = async (orderId, itemIds, userId, reason) => {
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
