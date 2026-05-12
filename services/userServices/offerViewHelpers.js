import { formatOfferLabel, getBestOfferForTarget } from "../offerEngine.js";

export const applyOfferToVariantView = (variant, product, offers) => {
  const pricing = getBestOfferForTarget({
    productId: product._id,
    categoryId: product.categoryId || product.categoryDetails?._id,
    basePrice: Number(variant.price),
    offers,
  });

  return {
    ...variant,
    originalPrice: Number(variant.price),
    price: pricing.finalPrice,
    offerDiscount: pricing.discountAmount,
    appliedOffer: pricing.appliedOffer
      ? {
          ...pricing.appliedOffer,
          label: formatOfferLabel(pricing.appliedOffer),
        }
      : null,
  };
};

export const applyOffersToProductCards = (products, offers) => {
  return products.map((product) => {
    const activeVariants = (product.activeVariants || []).map((variant) =>
      applyOfferToVariantView(variant, product, offers),
    );
    const startingPrice = Math.min(
      ...activeVariants.map((variant) => variant.price),
    );
    const originalStartingPrice = Math.min(
      ...activeVariants.map((variant) => variant.originalPrice),
    );
    const bestVariant =
      activeVariants.find((variant) => variant.price === startingPrice) ||
      activeVariants[0];

    return {
      ...product,
      activeVariants,
      startingPrice: Number(startingPrice.toFixed(2)),
      originalStartingPrice: Number(originalStartingPrice.toFixed(2)),
      appliedOffer: bestVariant?.appliedOffer || null,
    };
  });
};
