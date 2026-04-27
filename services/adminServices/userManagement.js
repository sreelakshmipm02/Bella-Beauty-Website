import User from "../../models/user.js";
import AppError from "../../utils/AppError.js";
import { ensureUsersReferralCodes } from "../userServices/referralCode.js";

// Fetches all users from the database sorted by newest first.
// export const getAllUsers = async () => {
//     return await User.find({}).sort({ createdAt: -1 });
// };

// Toggles a user's status between 'active' and 'suspended'.
 
export const toggleUserBlockStatus = async (userId) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new AppError("User not found", 404);
    }

    // Toggle logic using the enum defined in your schema
    user.status = user.status === "active" ? "suspended" : "active";
    await user.save();

    return user.status;
};

 // Fetches users with optional status filtering.
 // This can be reused by other controllers if needed.
 
export const fetchUsersWithFilter = async (status, search, page = 1, limit = 5) => {
    let filter = {};
    // 1. Apply Status Filter
    if (status && status !== 'all') {
        filter.status = status;
    }

    // 2. Apply Search Filter (Case-insensitive)
    if (search) {
        filter.$or = [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { userName: { $regex: search, $options: "i" } },
            { referralCode: { $regex: search, $options: "i" } }
        ];
    }
    const skip = (page - 1) * limit;
    
    // Fetch data and total count in parallel
    const [users, totalUsers] = await Promise.all([
        User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        User.countDocuments(filter)
    ]);

    return { users: await ensureUsersReferralCodes(users), totalUsers };
};
