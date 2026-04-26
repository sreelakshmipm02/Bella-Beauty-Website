import Offer from "../models/offer.js";

export const getActiveOffers = async () => {
    const now = new Date();

    return await Offer.find({
        status: "active",
        startDate: { $lte: now },
        endDate: { $gte: now }
    }).lean();
};

export const calculateOfferDiscount = (basePrice, offer) => {
    if (!offer || basePrice <= 0) return 0;

    let discount = 0;

    if (offer.discountType === "percentage") {
        discount = (basePrice * offer.discountValue) / 100;
    } else {
        discount = offer.discountValue;
    }

    if (offer.maxDiscountValue) {
        discount = Math.min(discount, offer.maxDiscountValue);
    }

    return Math.max(Math.min(discount, basePrice), 0);
};

export const getBestOfferForTarget = ({ productId, categoryId, basePrice, offers = [] }) => {
    const productIdString = productId?.toString?.() || String(productId || "");
    const categoryIdString = categoryId?.toString?.() || String(categoryId || "");

    let bestOffer = null;
    let bestDiscount = 0;

    for (const offer of offers) {
        const targetIdString = offer.targetId?.toString?.() || String(offer.targetId || "");
        const matchesProduct = offer.offerType === "product" && targetIdString === productIdString;
        const matchesCategory = offer.offerType === "category" && targetIdString === categoryIdString;

        if (!matchesProduct && !matchesCategory) continue;

        const currentDiscount = calculateOfferDiscount(basePrice, offer);
        if (currentDiscount > bestDiscount) {
            bestDiscount = currentDiscount;
            bestOffer = offer;
        }
    }

    return {
        appliedOffer: bestOffer,
        discountAmount: Number(bestDiscount.toFixed(2)),
        finalPrice: Number((basePrice - bestDiscount).toFixed(2))
    };
};

export const formatOfferLabel = (offer) => {
    if (!offer) return "";

    return offer.discountType === "percentage"
        ? `${offer.discountValue}% OFF`
        : `Save ₹${Number(offer.discountValue).toFixed(2)}`;
};
