import {
  sendSignupOtp,
  verifySignupOtpService,
  resendOtpService,
} from "../../services/userServices/userSignup.js";

import { createUser } from "../../services/userServices/createUser.js";

import { loginUser } from "../../services/userServices/userLogin.js";

import { getUserData } from "../../services/userServices/userAccount.js";
import {
  getReferralPreview,
  REFERRAL_OFFERS,
} from "../../services/userServices/referralCode.js";

import {
  getUserAddresses,
  addNewAddress,
  getAddressById,
  updateAddress,
  deleteAddress,
  setAddressAsDefault,
} from "../../services/userServices/userAddress.js";

import {
  updateUserProfile,
  requestEmailUpdateOtp,
  completeEmailUpdate,
} from "../../services/userServices/editProfile.js";

import {
  generateResetToken,
  resetUserPassword,
  changeUserPassword,
} from "../../services/userServices/userPassword.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";

const USER_SUSPENDED_REDIRECT = "/login?reason=suspended";

const getLoginPageState = (reason = "") => {
  if (reason === "suspended") {
    return {
      error: "Admin suspended your account. Please contact support.",
      message: null,
    };
  }

  return {
    error: null,
    message: null,
  };
};

//----------------------------------------------------------------------
//get signup page
export const signupPage = asyncHandler(async (req, res) => {
  const referralCodeFromQuery = req.query.ref || "";

  let referralPreview = null;
  let referralError = null;

  if (referralCodeFromQuery) {
    try {
      referralPreview = await getReferralPreview({
        referredByCode: referralCodeFromQuery,
      });
    } catch (error) {
      referralError = error.message;
    }
  }

  res.render("user/signup", {
    error: null,
    referralPreview,
    referralError,
    prefilledReferralCode:
      referralPreview?.code || referralCodeFromQuery.trim().toUpperCase(),
    referralOffers: REFERRAL_OFFERS,
  });
});

export const signupInvitePage = asyncHandler(async (req, res) => {
  let referralPreview = null;
  let referralError = null;

  try {
    referralPreview = await getReferralPreview({
      inviteToken: req.params.inviteToken,
    });
  } catch (error) {
    referralError = error.message;
  }

  res.render("user/signup", {
    error: null,
    referralPreview,
    referralError,
    prefilledReferralCode: referralPreview?.code || "",
    referralOffers: REFERRAL_OFFERS,
  });
});

export const verifyReferralAjax = asyncHandler(async (req, res) => {
  const referralPreview = await getReferralPreview({
    referredByCode: req.body.code || "",
    inviteToken: req.body.inviteToken || "",
  });

  res.status(200).json({
    success: true,
    message: "Referral verified successfully.",
    referral: referralPreview,
  });
});

//send signup otp
export const sendSignupOtpController = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await sendSignupOtp(email, req.body);
  res.status(200).json({ success: true, message: "OTP sent to email" });
});

// verify otp
export const verifySignupOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const userData = await verifySignupOtpService(email, otp);
  await createUser(userData);
  res.status(201).json({ success: true });
});

//resend signup otp
export const resendSignupOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await resendOtpService(email);
  res.status(200).json({ success: true, message: "OTP resent successfully" });
});

//----------------------------------------------------------------------
//get login page
export const loginPage = (req, res) => {
  res.render("user/login", getLoginPageState(req.query.reason));
};

//post login page
// post login page
export const loginSubmit = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // 1. Capture existing admin session data before user login
    const existingAdminId = req.session.adminId;

    const user = await loginUser(identifier, password);

    // 2. Set the User ID
    req.session.userId = user._id;

    // 3. Re-attach the Admin ID if it existed
    if (existingAdminId) {
      req.session.adminId = existingAdminId;
    }

    res.redirect("/");
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 403) {
      return res.redirect(USER_SUSPENDED_REDIRECT);
    }

    res.render("user/login", { error: error.message, message: null });
  }
};

//----------------------------------------------------------------------
//render user account page
export const userAccount = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const user = await getUserData(userId);
  res.render("user/account", {
    title: "My Account",
    user: user,
    referralOffers: REFERRAL_OFFERS,
  });
});

export const walletPage = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const user = await getUserData(userId);
  res.render("user/wallet", {
    title: "My Wallet",
    user: user,
  });
});

// 1. Update profile
export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  let filePath;
  if (req.file) {
    filePath = req.file.path || req.file.secure_url;
  }

  await updateUserProfile(userId, req.body, filePath);
  res
    .status(200)
    .json({ success: true, message: "Profile updated successfully!" });
});

// 2. Send otp for email update
export const sendUpdateEmailOtp = asyncHandler(async (req, res) => {
  const { newEmail } = req.body;
  await requestEmailUpdateOtp(newEmail);
  res.status(200).json({ success: true, message: "OTP sent to new email." });
});

// 3. Verify otp and update email
export const verifyEmailUpdate = asyncHandler(async (req, res) => {
  const { newEmail, otp } = req.body;
  const userId = req.session.userId;
  await completeEmailUpdate(userId, newEmail, otp);
  res
    .status(200)
    .json({ success: true, message: "Email updated successfully!" });
});
//----------------------------------------------------------------------
//user address page
export const addressPage = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const user = await getUserData(userId);
  const addresses = await getUserAddresses(userId);

  res.render("user/address", {
    title: "Manage Addresses",
    addresses: addresses || [],
    user,
  });
});

// Add Address
export const addAddress = asyncHandler(async (req, res) => {
  await addNewAddress(req.session.userId, req.body);
  res
    .status(201)
    .json({ success: true, message: "Address added successfully" });
});
// Fetch single address (API)
export const getSingleAddress = asyncHandler(async (req, res) => {
  const address = await getAddressById(
    req.params.addressId,
    req.session.userId,
  );
  if (!address) {
    throw new AppError("Address not found", 404);
  }
  res.status(200).json({ success: true, address });
});

// Edit Address
export const editAddress = asyncHandler(async (req, res) => {
  await updateAddress(req.params.addressId, req.session.userId, req.body);
  res
    .status(200)
    .json({ success: true, message: "Address updated successfully" });
});

// Delete Address
export const adressDelete = asyncHandler(async (req, res) => {
  await deleteAddress(req.params.addressId, req.session.userId);
  res
    .status(200)
    .json({ success: true, message: "Address deleted successfully" });
});

// Set Default
export const setAsDefault = asyncHandler(async (req, res) => {
  await setAddressAsDefault(req.params.addressId, req.session.userId);
  res.status(200).json({ success: true });
});

//----------------------------------------------------------------------
//render password management page
export const passwordPage = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const user = await getUserData(userId);
  res.render("user/password", {
    title: "Manage Password",
    user: user,
  });
});

//handle password update submission
export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await changeUserPassword(req.session.userId, currentPassword, newPassword);
  res.status(200).json({
    success: true,
    message: "Password updated successfully!",
  });
});

// Handle Forgot Password for Logged-In Users
export const forgotPasswordLoggedIn = async (req, res) => {
  try {
    // 1. Get the user's email using their session ID
    const user = await getUserData(req.session.userId);

    // 2. Re-use your existing service to send the email link
    await generateResetToken(user.email);

    // 3. Destroy session for security
    req.session.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//----------------------------------------------------------------------
// Logout process
export const userLogout = (req, res) => {
  if (req.session) {
    // ONLY delete the user key. adminId remains untouched.
    delete req.session.userId;
  }
  res.redirect("/login");
};

// Render Forgot Password Page
export const forgotPasswordPage = (req, res) => {
  res.render("user/forgot-password", { message: null, error: null });
};

// Handle Forgot Password Form
export const forgotPasswordSubmit = async (req, res) => {
  try {
    await generateResetToken(req.body.email);
    res.render("user/forgot-password", {
      message: "A reset link has been sent to your email.",
      error: null,
    });
  } catch (error) {
    res.render("user/forgot-password", { message: null, error: error.message });
  }
};

// Render Reset Password Page (from email link)
export const resetPasswordPage = (req, res) => {
  res.render("user/reset-password", { token: req.params.token, error: null });
};

// Handle New Password Submission
export const resetPasswordSubmit = async (req, res) => {
  try {
    await resetUserPassword(req.params.token, req.body.password);
    res.render("user/login", {
      error: null,
      message: "Password reset successful. Please login.",
    });
  } catch (error) {
    res.render("user/reset-password", {
      token: req.params.token,
      error: error.message,
    });
  }
};
