import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    brand: {
        type: String,
        default: "Aura",
        trim: true
    },
    description: {
        type: String,
        required: false,
        trim : true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "inactive"
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin" // Assuming you have an Admin model
    }
}, { timestamps: true }); // Automatically handles createdAt and updatedAt

export default mongoose.model("Product", productSchema);