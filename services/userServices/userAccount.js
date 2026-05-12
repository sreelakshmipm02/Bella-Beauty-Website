import User from "../../models/user.js";
import AppError from "../../utils/AppError.js";
import { ensureUserReferralCode } from "./referralCode.js";

export const getUserData = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const preparedUser = await ensureUserReferralCode(user);

  if (!preparedUser.wallet) {
    preparedUser.wallet = { balance: 0, transactions: [] };
  }

  if (!Array.isArray(preparedUser.wallet.transactions)) {
    preparedUser.wallet.transactions = [];
  }

  preparedUser.wallet.transactions.sort(
    (left, right) => new Date(right.createdAt) - new Date(left.createdAt),
  );

  return preparedUser;
};
