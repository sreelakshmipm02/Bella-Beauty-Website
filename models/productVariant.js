import mongoose from "mongoose";

// This represents the dynamic attributes mapping
const selectedAttributeSchema = new mongoose.Schema({
    attributeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Attribute",
        required: true
    },
    value: {
        type: String, 
        required: true
    }
}, { _id: false });

// This is the correct schema for Product Variants
const productVariantSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    sku: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        unique: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    images: [{
        type: String, 
        required: true
    }],
    attributes: [selectedAttributeSchema], 
    
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active"
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin"
    }
}, { timestamps: true });

export default mongoose.model("ProductVariant", productVariantSchema);