import User from "../../models/user.js";
import AppError from "../../utils/AppError.js";
import { ensureUserReferralCode } from "./referralCode.js";

export const getUserData = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    return await ensureUserReferralCode(user);
};
