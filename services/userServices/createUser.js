import User from "../../models/user.js";
import AppError from "../../utils/AppError.js";
import {
  applyReferralSignupRewards,
  generateUniqueReferralCode,
  generateUniqueReferralInviteToken,
  resolveReferralSource
} from "./referralCode.js";

// create user
export const createUser = async (userData) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    referredByCode
  } = userData;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError("Email already exists", 409);
  }

  const { referrer, normalizedCode } = await resolveReferralSource({ referredByCode });

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const userName = `${firstName.toLowerCase()}${randomNum}`;

  const user = new User({
    firstName,
    lastName,
    userName,
    email,
    phone,
    password,
    referralCode: await generateUniqueReferralCode(firstName),
    referralInviteToken: await generateUniqueReferralInviteToken(),
    referredByCode: normalizedCode,
    authProviders: {
      google: false,
      local: true
    }
  });

  const savedUser = await user.save();

  if (referrer) {
    await applyReferralSignupRewards({
      newUser: savedUser,
      referrer
    });
  }

  return savedUser;
};
