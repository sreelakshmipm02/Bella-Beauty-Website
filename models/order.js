import mongoose from "mongoose";

const generateOrderId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `ORD-${randomPart}`;
};

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        unique: true,
        default: generateOrderId 
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        productVariantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProductVariant",
            required: true
        },
        productName: { type: String, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true }, 
        quantity: { type: Number, required: true },
        itemTotal: { type: Number, required: true },
        status: {
            type: String,
            // Added "Return Approved"
            enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Return Requested", "Return Approved", "Return Rejected"],
            default: "Pending"
        },
        cancelReason: { type: String },
        adminRejectReason: { type: String } 
    }],
    shippingAddress: {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        addressLine1: { type: String, required: true },
        addressLine2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        postalCode: { type: String, required: true },
        country: { type: String, default: "India" }
    },
    payment: {
        method: {
            type: String,
            enum: ["COD", "Online", "Wallet"], 
            required: true
        },
        status: {
            type: String,
            enum: ["Pending", "Paid", "Failed", "Refunded"],
            default: "Pending"
        },
        transactionId: { type: String } 
    },
    summary: {
        subtotal: { type: Number, required: true },
        tax: { type: Number, required: true },
        shipping: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        total: { type: Number, required: true }
    },
    cancelReason: { type: String },
    returnReason: { type: String },
    orderStatus: {
        type: String,
        // Added "Return Approved"
        enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Return Requested", "Return Approved", "Return Rejected"],
        default: "Pending"
    }
}, { timestamps: true });

export default mongoose.model("Order", orderSchema);