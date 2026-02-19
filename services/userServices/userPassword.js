import User from "../../models/user.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { sendResetEmail } from "../../utils/otpService.js"; 

export const generateResetToken = async (email) => {
    const user = await User.findOne({ email });
    if (!user) throw new Error("User with this email does not exist.");

    // 1. Create a secure random token
    const token = crypto.randomBytes(32).toString("hex");

    // 2. Save token and 1-hour expiry to user record
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // 3. Send the email
    const resetUrl = `http://localhost:3000/reset-password/${token}`;
    await sendResetEmail(email, resetUrl);

    return true;
};

export const resetUserPassword = async (token, newPassword) => {
    // Find user with valid token that hasn't expired
    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) throw new Error("Password reset token is invalid or has expired.");

    // Hash and save new password
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();
    return true;
};