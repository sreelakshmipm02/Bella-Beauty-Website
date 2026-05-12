import { asyncHandler } from "../../middlewares/asyncHandler.js";
import {
  getAdminCouponsList,
  createCouponByAdmin,
  getCouponById,
  updateCouponById,
  toggleCouponStatusById,
} from "../../services/adminServices/couponManagement.js";

export const getCouponsPage = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 6;
  const { search } = req.query;

  const { coupons, totalCoupons } = await getAdminCouponsList(
    page,
    limit,
    search || "",
  );
  const totalPages = Math.ceil(totalCoupons / limit);

  res.render("admin/coupons", {
    title: "Coupon Management",
    coupons,
    searchQuery: search || "",
    currentPage: page,
    totalPages,
    totalCoupons,
    limit,
  });
});

export const createCoupon = asyncHandler(async (req, res) => {
  await createCouponByAdmin(req.body);
  res
    .status(201)
    .json({ success: true, message: "Coupon created successfully." });
});

export const getCouponDetails = asyncHandler(async (req, res) => {
  const coupon = await getCouponById(req.params.id);
  res.status(200).json({ success: true, coupon });
});

export const updateCoupon = asyncHandler(async (req, res) => {
  await updateCouponById(req.params.id, req.body);
  res
    .status(200)
    .json({ success: true, message: "Coupon updated successfully." });
});

export const toggleCouponStatus = asyncHandler(async (req, res) => {
  const isActive = await toggleCouponStatusById(req.params.id);
  res.status(200).json({
    success: true,
    message: `Coupon ${isActive ? "enabled" : "disabled"} successfully.`,
    isActive,
  });
});
