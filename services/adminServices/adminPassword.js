import Admin from "../../models/admin.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { sendResetEmail } from "../../utils/otpService.js"; 

// 1. Generate Token & Send Email
export const generateAdminResetToken = async (email) => {
    const admin = await Admin.findOne({ email });
    if (!admin) throw new Error("Admin with this email does not exist.");

    // Generate Token
    const token = crypto.randomBytes(32).toString("hex");

    // Save to DB (Expires in 1 Hour)
    admin.resetPasswordToken = token;
    admin.resetPasswordExpires = Date.now() + 3600000; 
    await admin.save();

    // Send Email (Admin Link)
    const resetUrl = `http://localhost:3000/admin/reset-password/${token}`;
    await sendResetEmail(email, resetUrl);

    return true;
};

// 2. Reset Password
export const resetAdminPassword = async (token, newPassword) => {
    const admin = await Admin.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() } // Check if not expired
    });

    if (!admin) throw new Error("Token is invalid or has expired.");

    // Hash new password
    admin.password = await bcrypt.hash(newPassword, 10);
    
    // Clear token fields
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpires = undefined;
    
    await admin.save();
    return true;
};