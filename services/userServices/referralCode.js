import User from "../../models/user.js";

const buildReferralCodeCandidate = (firstName = "") => {
    const base = (firstName || "BELLA")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 5) || "BELLA";
    const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(2, 8);
    return `${base}${suffix}`.slice(0, 12);
};

export const generateUniqueReferralCode = async (firstName = "") => {
    let referralCode = buildReferralCodeCandidate(firstName);

    while (await User.exists({ referralCode })) {
        referralCode = buildReferralCodeCandidate(firstName);
    }

    return referralCode;
};

export const ensureUserReferralCode = async (user) => {
    if (!user || user.referralCode) return user;

    user.referralCode = await generateUniqueReferralCode(user.firstName);
    await user.save();
    return user;
};

export const ensureUsersReferralCodes = async (users = []) => {
    const updatedUsers = [];

    for (const user of users) {
        if (!user.referralCode) {
            user.referralCode = await generateUniqueReferralCode(user.firstName);
            await user.save();
        }
        updatedUsers.push(user);
    }

    return updatedUsers;
};
