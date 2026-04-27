import User from "../../models/user.js";
import AppError from "../../utils/AppError.js";
import { generateUniqueReferralCode } from "./referralCode.js";

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

  // check existing user
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError("Email already exists", 409);
  }

  // generate username
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
  referredByCode: referredByCode ? referredByCode.trim().toUpperCase() : null,
  authProviders: {
    google: false,
    local: true //required
  }
});

  return await user.save();
};
