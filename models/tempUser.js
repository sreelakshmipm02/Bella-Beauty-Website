import mongoose from "mongoose";

const tempUserSchema = new mongoose.Schema(
    {
        firstName: String,
        lastName: String,
        email: {
            type: String,
            required: true,
            unique: true
        },
        phone: String,
        password: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true 
    });

// Auto delete after 10 minutes
tempUserSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });
const tempUser = mongoose.model("TempUser", tempUserSchema);
export default tempUser;