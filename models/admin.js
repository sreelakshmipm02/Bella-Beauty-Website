import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
    fullName: {
        type: String,
        default: "Super Admin"
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        default: ""
    },
    profileImage: {
        type: String,
        default: ""
    },
    password: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;