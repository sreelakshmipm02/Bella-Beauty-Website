import User from "../../models/user.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { sendResetEmail } from "../../utils/otpService.js";
import AppError from "../../utils/AppError.js";

export const generateResetToken = async (email) => {
  const user = await User.findOne({ email });
  if (!user) throw new AppError("User with this email does not exist.", 404);

  // 1. Create a secure random token
  const token = crypto.randomBytes(32).toString("hex");

  // 2. Save token and 1-hour expiry to user record
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  await user.save();

  // 3. Send the email
  const resetUrl = `https://sreestore.online/reset-password/${token}`;
  await sendResetEmail(email, resetUrl);

  return true;
};

export const resetUserPassword = async (token, newPassword) => {
  // Find user with valid token that hasn't expired
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user)
    throw new AppError("Password reset token is invalid or has expired.", 400);

  // Hash and save new password
  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();
  return true;
};

export const changeUserPassword = async (
  userId,
  currentPassword,
  newPassword,
) => {
  const user = await User.findById(userId);

  if (!user) throw new AppError("User not found.", 404);

  // Check if user signed up with Google and has no local password yet
  if (!user.password && user.authProviders?.google) {
    throw new AppError(
      "You logged in with Google. You cannot change a password you haven't set.",
      400,
    );
  }

  //verify current password
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw new AppError("Incorrect current password.", 401);

  //hash the new password and save
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  await user.save();

  return true;
};
