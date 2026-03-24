import mongoose from "mongoose";

// Custom Order ID Generator
const generateOrderId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPart = '';
    for (let i = 0; i < 6; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `ORD-${randomPart}`;
};

const orderSchema = new mongoose.Schema({
    // Your custom, readable Order ID
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
    
    // We save the exact name and price at the time of purchase.
    items: [{
        productVariantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProductVariant",
            required: true
        },
        productName: { type: String, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true }, // Price *at the time* of checkout
        quantity: { type: Number, required: true },
        itemTotal: { type: Number, required: true },
        
        // Individual item status (In case one item gets cancelled but others ship!)
        status: {
            type: String,
            enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"],
            default: "Pending"
        }
    }],

    // Saved here so old orders don't break if the user deletes their address later.
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

    // 3. PAYMENT DETAILS
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
        transactionId: { type: String } // To store Razorpay/Stripe IDs later
    },

    // 4. PRICE SUMMARY
    summary: {
        subtotal: { type: Number, required: true },
        tax: { type: Number, required: true },
        shipping: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        total: { type: Number, required: true }
    },

    // 5. MASTER ORDER STATUS
    orderStatus: {
        type: String,
        enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"],
        default: "Pending"
    }
}, { timestamps: true });

export default mongoose.model("Order", orderSchema);