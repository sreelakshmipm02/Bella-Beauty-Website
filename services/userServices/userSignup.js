import User from "../../models/user.js";
import Otp from "../../models/otp.js";
import TempUser from "../../models/tempUser.js";
import bcrypt from "bcrypt";
import { generateOtp, sendOtpEmail } from "../../utils/otpService.js";
import AppError from "../../utils/AppError.js";
import { resolveReferralSource } from "./referralCode.js";


//SIGNUP SERVICE
export const sendSignupOtp = async (email, payload) => {
  // i. Check if user already exists
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    const isGoogleOnlyUser =
      existingUser.authProviders?.google === true &&
      existingUser.authProviders?.local !== true;

    if (isGoogleOnlyUser) {
      throw new AppError(
        "This email is already registered using Google. Please sign in with Google or set a password."
        ,409
      );
    }

    throw new AppError("Email already registered. Please login.", 409);
  }

  // ii. Send OTP
  await sendSignupOtpService(payload);

  return true;
};

//OTP SENDING SERVICE
export const sendSignupOtpService = async (userData) => {
  const { firstName, lastName, email, phone, password, referredByCode } = userData;
  if (!email) {
    throw new AppError("Email is required!", 400);
  }

  const { normalizedCode } = await resolveReferralSource({ referredByCode });

  //i.generate OTP
  const otp = generateOtp();

  //ii.remove old OTP
  await Otp.deleteMany({ email });

  //iii.save new OTP
  await Otp.create({ email, otp });

  //iv.store temp user
  // Check if a temp user already exists
  const existingTempUser = await TempUser.findOne({ email });

  // If they exist, DELETE them so we can create a fresh record (Fixes "OTP already sent" error)
  if (existingTempUser) {
    await TempUser.deleteMany({ email });
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  await TempUser.create({
    firstName,
    lastName,
    email,
    phone,
    referredByCode: normalizedCode,
    password: hashedPassword
  });

  //v.send email
  await sendOtpEmail(email, otp);
  return true;
};

//OTP VERIFY SERVICE
export const verifySignupOtpService = async (email, otp) => {
  const record = await Otp.findOne({ email, otp });

  if (!record) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  const userData = await TempUser.findOne({ email });

  if (!userData) {
    throw new AppError("Session expired! Signup again.", 410);
  }
  // cleanup
  await Otp.deleteMany({ email });
  await TempUser.deleteMany({ email });
  return userData;
};

// resend otp service
export const resendOtpService = async (email) => {
  // 1. Check if TempUser still exists (if not, the session is truly dead)
  const userData = await TempUser.findOne({ email });
  if (!userData) {
    throw new AppError("Signup session expired. Please sign up again.", 410);
  }

  // 2. Generate new OTP
  const newOtp = generateOtp();

  // 3. Update the OTP collection (The source of truth for verification)
  await Otp.deleteMany({ email });
  await Otp.create({ email, otp: newOtp }); 

  // 4. Update TempUser timestamp only
  await TempUser.findOneAndUpdate(
    { email },
    { $set: { updatedAt: new Date() } }
  );

  // 5. Send email
  await sendOtpEmail(email, newOtp);
  return true;
};
