import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
    productVariantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductVariant",
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    }
}, { _id: false }); // Prevents Mongoose from creating a separate _id for every item inside the array

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true // One user strictly equals one cart
    },
    items: [cartItemSchema]
}, { timestamps: true });

export default mongoose.model("Cart", cartSchema);