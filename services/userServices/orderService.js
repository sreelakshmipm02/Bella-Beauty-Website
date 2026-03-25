import Order from "../../models/order.js";
import Cart from "../../models/cart.js";
import ProductVariant from "../../models/productVariant.js";
import { getCartData } from "./cartService.js";
import { getAddressById } from "./userAddress.js";

export const processCheckout = async (userId, addressId, paymentMethod) => {
    // 1. Fetch Cart & Address
    const cartData = await getCartData(userId);
    if (!cartData || cartData.items.length === 0) {
        throw new Error("Your cart is empty.");
    }

    const address = await getAddressById(addressId, userId);
    if (!address) {
        throw new Error("Shipping address not found.");
    }

    // 2. Format Items for the Order Snapshot
    const orderItems = cartData.items.map(item => ({
        productVariantId: item.variantId,
        productName: item.productName,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        itemTotal: item.itemTotal,
        status: "Pending"
    }));

    // 3. Create the Order Document
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
            status: paymentMethod === 'COD' ? 'Pending' : 'Paid'
        },
        summary: cartData.summary,
        orderStatus: "Pending"
    });

    const savedOrder = await newOrder.save();

    // 4. DEDUCT STOCK DYNAMICALLY
    for (let item of cartData.items) {
        await ProductVariant.findByIdAndUpdate(
            item.variantId,
            { $inc: { stock: -item.quantity } } // Subtracts the purchased amount
        );
    }

    // 5. EMPTY THE CART
    await Cart.findOneAndUpdate(
        { userId },
        { $set: { items: [] } }
    );

    return savedOrder;
};

// ==========================================
// FETCH USER ORDERS (With Search)
// ==========================================
export const getUserOrders = async (userId, searchQuery = '') => {
    let query = { userId };
    
    // If the user types in the search bar, look for matching Order IDs
    if (searchQuery) {
        query.orderId = { $regex: searchQuery, $options: 'i' };
    }

    // Sort by newest first
    return await Order.find(query).sort({ createdAt: -1 });
};

// ==========================================
// FETCH SINGLE ORDER DETAILS
// ==========================================
export const getOrderById = async (orderId, userId) => {
    // We include userId in the query to strictly prevent users from viewing others' receipts
    return await Order.findOne({ _id: orderId, userId }).populate('items.productVariantId');
};

// ==========================================
// CANCEL ENTIRE ORDER
// ==========================================
export const cancelWholeOrderService = async (orderId, userId, reason) => {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) throw new Error("Order not found");
    if (order.orderStatus === 'Shipped' || order.orderStatus === 'Delivered') {
        throw new Error("Cannot cancel an order that has already shipped.");
    }

    // 1. Return stock for every item that hasn't already been cancelled
    for (let item of order.items) {
        if (item.status !== 'Cancelled') {
            await ProductVariant.findByIdAndUpdate(item.productVariantId, { $inc: { stock: item.quantity } });
            item.status = 'Cancelled';
            item.cancelReason = reason;
        }
    }

    // 2. Update master order
    order.orderStatus = 'Cancelled';
    order.cancelReason = reason;
    await order.save();

    return order;
};

// ==========================================
// CANCEL SPECIFIC ITEM
// ==========================================
export const cancelOrderItemService = async (orderId, itemId, userId, reason) => {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) throw new Error("Order not found");
    if (order.orderStatus === 'Shipped' || order.orderStatus === 'Delivered') {
        throw new Error("Cannot cancel items for an order that has already shipped.");
    }

    const item = order.items.id(itemId);
    if (!item || item.status === 'Cancelled') throw new Error("Item already cancelled or not found");

    // 1. Return stock just for this item
    await ProductVariant.findByIdAndUpdate(item.productVariantId, { $inc: { stock: item.quantity } });
    
    // 2. Update item status
    item.status = 'Cancelled';
    item.cancelReason = reason;

    // 3. Check if ALL items are now cancelled. If yes, cancel the whole order.
    const allCancelled = order.items.every(i => i.status === 'Cancelled');
    if (allCancelled) {
        order.orderStatus = 'Cancelled';
        order.cancelReason = "All items cancelled individually";
    }

    await order.save();
    return order;
};

// ==========================================
// REQUEST ORDER RETURN
// ==========================================
export const returnOrderService = async (orderId, userId, reason) => {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) throw new Error("Order not found");
    if (order.orderStatus !== 'Delivered') {
        throw new Error("Only delivered orders can be returned.");
    }

    // Usually, returns trigger a "Return Requested" status for the admin to approve, 
    // but we will mark it "Returned" here based on your UI setup.
    order.orderStatus = 'Returned';
    order.returnReason = reason;
    
    // Mark all delivered items as Returned
    order.items.forEach(item => {
        if (item.status === 'Delivered') item.status = 'Returned';
    });

    await order.save();
    return order;
};