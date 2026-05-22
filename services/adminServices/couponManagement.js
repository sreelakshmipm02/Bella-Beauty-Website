import Coupon from "../../models/coupon.js";
import AppError from "../../utils/AppError.js";

const normalizeCode = (code) => code.trim().toUpperCase();
const couponCodePattern = /^[A-Z0-9_-]{3,20}$/;

export const getAdminCouponsList = async (page = 1, limit = 6, search = "") => {
  const skip = (page - 1) * limit;
  const query = {};

  if (search) {
    query.code = { $regex: search, $options: "i" };
  }

  const [coupons, totalCoupons] = await Promise.all([
    Coupon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Coupon.countDocuments(query),
  ]);

  return { coupons, totalCoupons };
};

export const createCouponByAdmin = async (couponData) => {
  const {
    code,
    description,
    discountType,
    discountValue,
    minOrderAmount,
    maxDiscount,
    expiresAt,
    usageLimit,
  } = couponData;

  if (
    !code ||
    !discountType ||
    !discountValue ||
    minOrderAmount === "" ||
    maxDiscount === "" ||
    !expiresAt ||
    usageLimit === ""
  ) {
    throw new AppError("All coupon fields are required.", 400);
  }

  const normalizedCode = normalizeCode(code);

  if (!couponCodePattern.test(normalizedCode)) {
    throw new AppError(
      "Coupon code must be 3 to 20 characters and can contain letters, numbers, hyphens, or underscores.",
      400,
    );
  }

  const existingCoupon = await Coupon.findOne({ code: normalizedCode });

  if (existingCoupon) {
    throw new AppError("A coupon with this code already exists.", 409);
  }

  const parsedDiscountValue = Number(discountValue);
  const parsedMinOrderAmount = Number(minOrderAmount || 0);
  const parsedMaxDiscount = Number(maxDiscount);
  const parsedUsageLimit = Number(usageLimit);
  const parsedExpiresAt = new Date(expiresAt);

  if (Number.isNaN(parsedDiscountValue) || parsedDiscountValue <= 0) {
    throw new AppError("Discount value must be greater than 0.", 400);
  }

  if (Number.isNaN(parsedMinOrderAmount) || parsedMinOrderAmount < 0) {
    throw new AppError("Minimum purchase value must be 0 or greater.", 400);
  }

  if (Number.isNaN(parsedMaxDiscount) || parsedMaxDiscount <= 0) {
    throw new AppError("Maximum discount value must be greater than 0.", 400);
  }

  if (parsedMaxDiscount > parsedMinOrderAmount && parsedMinOrderAmount > 0) {
    throw new AppError(
      "Maximum discount value cannot be greater than the minimum purchase value.",
      400,
    );
  }

  if (discountType === "percentage" && parsedDiscountValue > 100) {
    throw new AppError("Percentage discount cannot exceed 100.", 400);
  }

  if (
    Number.isNaN(parsedUsageLimit) ||
    parsedUsageLimit < 1 ||
    !Number.isInteger(parsedUsageLimit)
  ) {
    throw new AppError(
      "Usage limit must be a whole number greater than or equal to 1.",
      400,
    );
  }

  if (Number.isNaN(parsedExpiresAt.getTime())) {
    throw new AppError("Offer validity date is invalid.", 400);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsedExpiresAt.setHours(0, 0, 0, 0);

  if (parsedExpiresAt < today) {
    throw new AppError("Offer validity must be today or a future date.", 400);
  }

  const coupon = new Coupon({
    code: normalizedCode,
    discountType,
    discountValue: parsedDiscountValue,
    minOrderAmount: Number.isNaN(parsedMinOrderAmount)
      ? 0
      : parsedMinOrderAmount,
    maxDiscount: parsedMaxDiscount,
    usageLimit: parsedUsageLimit,
    expiresAt: parsedExpiresAt,
    isActive: true,
  });

  await coupon.save();
  return coupon;
};

export const getCouponById = async (couponId) => {
  const coupon = await Coupon.findById(couponId).lean();
  if (!coupon) throw new AppError("Coupon not found.", 404);
  return coupon;
};

export const updateCouponById = async (couponId, couponData) => {
  const {
    code,
    description,
    discountType,
    discountValue,
    minOrderAmount,
    maxDiscount,
    expiresAt,
    usageLimit,
  } = couponData;

  if (
    !code ||
    !discountType ||
    !discountValue ||
    minOrderAmount === "" ||
    maxDiscount === "" ||
    !expiresAt ||
    usageLimit === ""
  ) {
    throw new AppError("All coupon fields are required.", 400);
  }

  const normalizedCode = normalizeCode(code);

  if (!couponCodePattern.test(normalizedCode)) {
    throw new AppError(
      "Coupon code must be 3 to 20 characters and can contain letters, numbers, hyphens, or underscores.",
      400,
    );
  }

  const existingCoupon = await Coupon.findOne({
    code: normalizedCode,
    _id: { $ne: couponId },
  });

  if (existingCoupon) {
    throw new AppError(
      "A different coupon with this code already exists.",
      409,
    );
  }

  const parsedDiscountValue = Number(discountValue);
  const parsedMinOrderAmount = Number(minOrderAmount || 0);
  const parsedMaxDiscount = Number(maxDiscount);
  const parsedUsageLimit = Number(usageLimit);
  const parsedExpiresAt = new Date(expiresAt);

  if (Number.isNaN(parsedDiscountValue) || parsedDiscountValue <= 0) {
    throw new AppError("Discount value must be greater than 0.", 400);
  }

  if (Number.isNaN(parsedMinOrderAmount) || parsedMinOrderAmount < 0) {
    throw new AppError("Minimum purchase value must be 0 or greater.", 400);
  }

  if (Number.isNaN(parsedMaxDiscount) || parsedMaxDiscount <= 0) {
    throw new AppError("Maximum discount value must be greater than 0.", 400);
  }

  if (parsedMaxDiscount > parsedMinOrderAmount && parsedMinOrderAmount > 0) {
    throw new AppError(
      "Maximum discount value cannot be greater than the minimum purchase value.",
      400,
    );
  }

  if (discountType === "percentage" && parsedDiscountValue > 100) {
    throw new AppError("Percentage discount cannot exceed 100.", 400);
  }

  if (
    Number.isNaN(parsedUsageLimit) ||
    parsedUsageLimit < 1 ||
    !Number.isInteger(parsedUsageLimit)
  ) {
    throw new AppError(
      "Usage limit must be a whole number greater than or equal to 1.",
      400,
    );
  }

  if (Number.isNaN(parsedExpiresAt.getTime())) {
    throw new AppError("Offer validity date is invalid.", 400);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsedExpiresAt.setHours(0, 0, 0, 0);

  if (parsedExpiresAt < today) {
    throw new AppError("Offer validity must be today or a future date.", 400);
  }

  const coupon = await Coupon.findByIdAndUpdate(
    couponId,
    {
      code: normalizedCode,
      discountType,
      discountValue: parsedDiscountValue,
      minOrderAmount: Number.isNaN(parsedMinOrderAmount)
        ? 0
        : parsedMinOrderAmount,
      maxDiscount: parsedMaxDiscount,
      usageLimit: parsedUsageLimit,
      expiresAt: parsedExpiresAt,
    },
    { new: true },
  );

  if (!coupon) throw new AppError("Coupon not found.", 404);
  return coupon;
};

export const toggleCouponStatusById = async (couponId) => {
  const coupon = await Coupon.findById(couponId);
  if (!coupon) throw new AppError("Coupon not found.", 404);

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  return coupon.isActive;
};
