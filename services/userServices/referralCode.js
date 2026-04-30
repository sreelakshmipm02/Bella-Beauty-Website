import crypto from "crypto";
import User from "../../models/user.js";
import AppError from "../../utils/AppError.js";
import { creditWallet, debitWallet } from "../walletService.js";

export const REFERRAL_OFFERS = {
    refereeReward: 100,
    referrerReward: 150
};

const formatUserName = (user) => {
    if (!user) return "Bella Member";
    return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Bella Member";
};

const normalizeReferralCode = (value = "") => value.trim().toUpperCase();
const normalizeInviteToken = (value = "") => value.trim().toUpperCase();

const buildReferralCodeCandidate = (firstName = "") => {
    const base = (firstName || "BELLA")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 5) || "BELLA";
    const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(2, 8);
    return `${base}${suffix}`.slice(0, 12);
};

const buildInviteTokenCandidate = () => crypto.randomBytes(8).toString("hex").toUpperCase();

export const generateUniqueReferralCode = async (firstName = "") => {
    let referralCode = buildReferralCodeCandidate(firstName);

    while (await User.exists({ referralCode })) {
        referralCode = buildReferralCodeCandidate(firstName);
    }

    return referralCode;
};

export const generateUniqueReferralInviteToken = async () => {
    let referralInviteToken = buildInviteTokenCandidate();

    while (await User.exists({ referralInviteToken })) {
        referralInviteToken = buildInviteTokenCandidate();
    }

    return referralInviteToken;
};

export const ensureUserReferralCode = async (user) => {
    if (!user) return user;

    let shouldSave = false;

    if (!user.referralCode) {
        user.referralCode = await generateUniqueReferralCode(user.firstName);
        shouldSave = true;
    }

    if (!user.referralInviteToken) {
        user.referralInviteToken = await generateUniqueReferralInviteToken();
        shouldSave = true;
    }

    if (shouldSave) {
        await user.save();
    }

    return user;
};

export const ensureUsersReferralCodes = async (users = []) => {
    const updatedUsers = [];

    for (const user of users) {
        updatedUsers.push(await ensureUserReferralCode(user));
    }

    return updatedUsers;
};

export const findUserByReferralCode = async (referralCode) => {
    const normalizedCode = normalizeReferralCode(referralCode);

    if (!normalizedCode) {
        throw new AppError("Referral code is required.", 400);
    }

    const user = await User.findOne({ referralCode: normalizedCode });

    if (!user) {
        throw new AppError("Referral code not found.", 404);
    }

    return await ensureUserReferralCode(user);
};

export const findUserByInviteToken = async (inviteToken) => {
    const normalizedToken = normalizeInviteToken(inviteToken);

    if (!normalizedToken) {
        throw new AppError("Invite token is required.", 400);
    }

    const user = await User.findOne({ referralInviteToken: normalizedToken });

    if (!user) {
        throw new AppError("This invite link is invalid or expired.", 404);
    }

    return await ensureUserReferralCode(user);
};

export const resolveReferralSource = async ({ referredByCode = "", inviteToken = "" } = {}) => {
    if (inviteToken) {
        const referrer = await findUserByInviteToken(inviteToken);
        return { referrer, normalizedCode: referrer.referralCode };
    }

    if (referredByCode) {
        const referrer = await findUserByReferralCode(referredByCode);
        return { referrer, normalizedCode: referrer.referralCode };
    }

    return { referrer: null, normalizedCode: null };
};

export const getReferralPreview = async ({ referredByCode = "", inviteToken = "" } = {}) => {
    const { referrer, normalizedCode } = await resolveReferralSource({ referredByCode, inviteToken });

    if (!referrer) {
        throw new AppError("Referral details not found.", 404);
    }

    return {
        code: normalizedCode,
        inviteToken: referrer.referralInviteToken,
        inviterName: formatUserName(referrer),
        rewardText: `Sign up with this referral and get ₹${REFERRAL_OFFERS.refereeReward} in your wallet.`
    };
};

export const applyReferralSignupRewards = async ({ newUser, referrer }) => {
    if (!newUser || !referrer) {
        return null;
    }

    if (String(newUser._id) === String(referrer._id)) {
        throw new AppError("You cannot use your own referral.", 400);
    }

    let refereeRewardApplied = false;

    try {
        await creditWallet({
            userId: newUser._id,
            amount: REFERRAL_OFFERS.refereeReward,
            description: `Referral welcome reward from ${formatUserName(referrer)}`
        });
        refereeRewardApplied = true;

        await creditWallet({
            userId: referrer._id,
            amount: REFERRAL_OFFERS.referrerReward,
            description: `Referral reward for inviting ${formatUserName(newUser)}`
        });

        return {
            refereeReward: REFERRAL_OFFERS.refereeReward,
            referrerReward: REFERRAL_OFFERS.referrerReward
        };
    } catch (error) {
        if (refereeRewardApplied) {
            try {
                await debitWallet({
                    userId: newUser._id,
                    amount: REFERRAL_OFFERS.refereeReward,
                    description: `Referral reward reversal for ${newUser.email || formatUserName(newUser)}`
                });
            } catch (reversalError) {
                console.error("Referral reward reversal failed:", reversalError);
            }
        }

        throw error;
    }
};
