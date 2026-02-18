import User from "../../models/user.js";
import Otp from "../../models/otp.js";
import { generateOtp, sendOtpEmail } from "../../utils/otpService.js";

// 1. Update Profile Logic
export const updateUserProfile = async (userId, userData, filePath) => {
    const { firstName, lastName, phone } = userData;

    // 1. Prepare the update object
    const updates = {
        firstName,
        lastName,
        phone
    };

    // 2. DEBUG: Log what we are trying to save
    console.log("Service received filePath:", filePath);

    // 3. If a file was uploaded, add it to the updates
    if (filePath) {
        updates.profileImage = filePath;
    }

    // 4. Update the User in MongoDB
    // { new: true } returns the updated document so we can see it
    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });

    console.log("Updated User in DB:", updatedUser); // <--- Check if profileImage is here

    return updatedUser;
};

// 2. Initiate Email Update (Check existence + Send OTP)
export const requestEmailUpdateOtp = async (newEmail) => {
    // Check if email is already taken by ANOTHER user
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
        throw new Error("Email already in use.");
    }

    // Generate OTP
    const otp = generateOtp();

    // Delete old OTPs for this email and save the new one
    await Otp.deleteMany({ email: newEmail });
    await Otp.create({ email: newEmail, otp });

    // Send Email
    await sendOtpEmail(newEmail, otp);

    return true;
};

// 3. Confirm Email Update (Verify OTP + Update DB)
export const completeEmailUpdate = async (userId, newEmail, otp) => {
    // Verify OTP
    const record = await Otp.findOne({ email: newEmail, otp });

    if (!record) {
        throw new Error("Invalid or Expired OTP");
    }

    // Update User Email
    await User.findByIdAndUpdate(userId, { email: newEmail });

    // Cleanup OTP
    await Otp.deleteMany({ email: newEmail });

    return true;
};