import mongoose from "mongoose";

const attributeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        label: {
            type: String,
            required: true,
            trim: true
        },
        dataType: {
            type: String,
            enum: ["string", "number", "array", "enum"],
            required: true
        },
        possibleValues: {
            type: [String],
            default: []
        }
    }, { timestamps: true }
);
export default mongoose.model("Attribute", attributeSchema);