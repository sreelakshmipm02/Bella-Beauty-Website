import Offer from "../../models/offer.js";
import Product from "../../models/product.js";
import Category from "../../models/category.js";
import AppError from "../../utils/AppError.js";

const validNameCount = (value = "") => value.replace(/[^a-zA-Z0-9]/g, "").length;

const normalizeOfferPayload = (payload) => {
  const {
    offerName,
    offerType,
    targetId,
    discountType,
    discountValue,
    maxDiscountValue,
    startDate,
    endDate,
  } = payload;

  if (
    !offerName ||
    !offerType ||
    !targetId ||
    !discountType ||
    !discountValue ||
    !maxDiscountValue ||
    !startDate ||
    !endDate
  ) {
    throw new AppError("All offer fields are required.", 400);
  }

  const parsedDiscountValue = Number(discountValue);
  const parsedMaxDiscountValue = Number(maxDiscountValue);
  const parsedStartDate = new Date(startDate);
  const parsedEndDate = new Date(endDate);

  if (!["product", "category"].includes(offerType)) {
    throw new AppError("Offer type must be product or category.", 400);
  }

  if (validNameCount(offerName.trim()) < 3) {
    throw new AppError(
      "Offer name must contain at least 3 letters or numbers.",
      400,
    );
  }

  if (!["flat", "percentage"].includes(discountType)) {
    throw new AppError("Discount type must be flat or percentage.", 400);
  }

  if (Number.isNaN(parsedDiscountValue) || parsedDiscountValue <= 0) {
    throw new AppError("Discount value must be greater than 0.", 400);
  }

  if (discountType === "percentage" && parsedDiscountValue > 100) {
    throw new AppError("Percentage discount cannot exceed 100.", 400);
  }

  if (Number.isNaN(parsedMaxDiscountValue) || parsedMaxDiscountValue <= 0) {
    throw new AppError("Maximum discount value must be greater than 0.", 400);
  }

  if (
    Number.isNaN(parsedStartDate.getTime()) ||
    Number.isNaN(parsedEndDate.getTime())
  ) {
    throw new AppError("Offer validity dates are invalid.", 400);
  }

  if (parsedEndDate < parsedStartDate) {
    throw new AppError("End date must be on or after the start date.", 400);
  }

  return {
    offerName: offerName.trim(),
    offerType,
    targetId,
    discountType,
    discountValue: parsedDiscountValue,
    maxDiscountValue: parsedMaxDiscountValue,
    startDate: parsedStartDate,
    endDate: parsedEndDate,
  };
};

const ensureTargetExists = async (offerType, targetId) => {
  const model = offerType === "product" ? Product : Category;
  const target = await model.findById(targetId);

  if (!target) {
    throw new AppError(
      `${offerType === "product" ? "Product" : "Category"} not found.`,
      404,
    );
  }
};

export const getOfferFormOptions = async () => {
  const [products, categories] = await Promise.all([
    // Ensure categoryId is included in the select query
    Product.find({ status: "active" })
      .sort({ name: 1 })
      .select("name categoryId"),
    Category.find({ status: "active" }).sort({ name: 1 }).select("name"),
  ]);

  return { products, categories };
};

export const getAdminOffersList = async (page = 1, limit = 6, search = "") => {
  const skip = (page - 1) * limit;
  const query = {};

  if (search) {
    query.offerName = { $regex: search, $options: "i" };
  }

  const [offers, totalOffers] = await Promise.all([
    Offer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Offer.countDocuments(query),
  ]);

  return { offers, totalOffers };
};

export const createOfferByAdmin = async (payload) => {
  const normalizedPayload = normalizeOfferPayload(payload);
  await ensureTargetExists(
    normalizedPayload.offerType,
    normalizedPayload.targetId,
  );

  const offer = new Offer({
    ...normalizedPayload,
    status: "active",
  });

  await offer.save();
  return offer;
};

export const getOfferById = async (offerId) => {
  const offer = await Offer.findById(offerId).lean();
  if (!offer) throw new AppError("Offer not found.", 404);
  return offer;
};

export const updateOfferById = async (offerId, payload) => {
  const normalizedPayload = normalizeOfferPayload(payload);
  await ensureTargetExists(
    normalizedPayload.offerType,
    normalizedPayload.targetId,
  );

  const offer = await Offer.findByIdAndUpdate(offerId, normalizedPayload, {
    new: true,
  });
  if (!offer) throw new AppError("Offer not found.", 404);
  return offer;
};

export const toggleOfferStatusById = async (offerId) => {
  const offer = await Offer.findById(offerId);
  if (!offer) throw new AppError("Offer not found.", 404);

  offer.status = offer.status === "active" ? "inactive" : "active";
  await offer.save();

  return offer.status;
};
