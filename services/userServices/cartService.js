import Cart from "../../models/cart.js";
import Coupon from "../../models/coupon.js";
import ProductVariant from "../../models/productVariant.js";
import Product from "../../models/product.js";
import Category from "../../models/category.js";
import AppError from "../../utils/AppError.js";
import { getActiveOffers, formatOfferLabel, getBestOfferForTarget } from "../offerEngine.js";

// Some basic limits and tax
const MAX_QTY_PER_ITEM = 5;
const GST_RATE = 0.18; // 18% tax

// This function calculates total price, tax, and shipping
const EMPTY_COUPON = {
    couponId: null,
    code: null,
    discountAmount: 0
};

const calculateCartTotals = (items, discountAmount = 0) => {
    let originalGrossSubtotal = 0;
    let grossSubtotal = 0;

    // Add price only if item is available
    items.forEach(item => {
        if (!item.outOfStock) {
            originalGrossSubtotal += (item.originalPrice * item.quantity);
            grossSubtotal += (item.price * item.quantity);
        }
    });

    const offerSavings = Math.max(originalGrossSubtotal - grossSubtotal, 0);

    // Split tax from total
    const preTaxAmount = grossSubtotal / (1 + GST_RATE);
    const taxAmount = grossSubtotal - preTaxAmount;

    // Shipping rules
    const FREE_SHIPPING_THRESHOLD = 500;
    const STANDARD_DELIVERY_CHARGE = 40;

    let shippingCost = 0;

    // Apply shipping charge only if below 500
    if (grossSubtotal > 0 && grossSubtotal < FREE_SHIPPING_THRESHOLD) {
        shippingCost = STANDARD_DELIVERY_CHARGE;
    }

    const safeDiscount = Math.min(Number(discountAmount) || 0, grossSubtotal + shippingCost);
    const finalTotal = Math.max(grossSubtotal + shippingCost - safeDiscount, 0);

    return {
        subtotal: preTaxAmount.toFixed(2),
        tax: taxAmount.toFixed(2),
        shipping: shippingCost,
        discount: safeDiscount.toFixed(2),
        offerSavings: offerSavings.toFixed(2),
        totalDiscount: (offerSavings + safeDiscount).toFixed(2),
        total: finalTotal.toFixed(2),
        totalItems: items.length,
        originalGrossSubtotal: originalGrossSubtotal.toFixed(2),
        grossSubtotal: grossSubtotal.toFixed(2)
    };
};

const clearAppliedCoupon = (cart) => {
    cart.appliedCoupon = { ...EMPTY_COUPON };
};

const getEligibleCouponDiscount = (coupon, grossSubtotal) => {
    if (!coupon || !coupon.isActive) return 0;
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return 0;
    if (grossSubtotal < (coupon.minOrderAmount || 0)) return 0;

    let discount = 0;

    if (coupon.discountType === "percentage") {
        discount = (grossSubtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscount) {
            discount = Math.min(discount, coupon.maxDiscount);
        }
    } else {
        discount = coupon.discountValue;
    }

    return Math.max(Math.min(discount, grossSubtotal), 0);
};

// Check if product, variant, and category are active
const variantIsActive = async (variant) => {
    if (!variant || variant.status !== 'active') return false;

    const product = await Product.findById(variant.productId).populate('categoryId');
    if (!product || product.status !== 'active') return false;

    const category = product.categoryId;
    if (!category || category.status !== 'active') return false;

    return true;
};

// Add item to cart
export const addItemToCart = async (userId, variantId, quantity = 1) => {

    // Get variant details
    const variant = await ProductVariant.findById(variantId).populate('productId');

    // Basic checks before adding
    if (!await variantIsActive(variant)) throw new AppError("This product is currently unavailable.", 404);
    if (variant.stock <= 0) throw new AppError("This item is out of stock.", 409);
    if (quantity > variant.stock) throw new AppError(`Only ${variant.stock} left in stock.`, 409);
    if (quantity > MAX_QTY_PER_ITEM) throw new AppError(`Maximum limit is ${MAX_QTY_PER_ITEM} per item.`, 400);

    // Find user cart
    let cart = await Cart.findOne({ userId });

    // If cart not exists, create one
    if (!cart) cart = new Cart({ userId, items: [] });

    // Check if item already in cart
    const existingItemIndex = cart.items.findIndex(
        item => item.productVariantId.toString() === variantId.toString()
    );

    if (existingItemIndex > -1) {
        // If exists, increase quantity
        const newQty = cart.items[existingItemIndex].quantity + quantity;

        if (newQty > variant.stock) throw new AppError(`Cannot add more. Only ${variant.stock} left.`, 409);
        if (newQty > MAX_QTY_PER_ITEM) throw new AppError(`Limit of ${MAX_QTY_PER_ITEM} reached.`, 400);

        cart.items[existingItemIndex].quantity = newQty;
    } else {
        // If new item, add to cart
        cart.items.push({ productVariantId: variantId, quantity });
    }

    await cart.save();
    return cart;
};

const formatCouponForClient = (appliedCoupon) => {
    if (!appliedCoupon?.code || !appliedCoupon?.discountAmount) return null;

    return {
        code: appliedCoupon.code,
        discountAmount: Number(appliedCoupon.discountAmount).toFixed(2)
    };
};

const buildAvailableCouponsForClient = async (grossSubtotal, appliedCouponCode = null) => {
    const coupons = await Coupon.find({
        isActive: true,
        $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gte: new Date() } }
        ]
    })
        .sort({ createdAt: -1 })
        .lean();

    return coupons.map((coupon) => {
        const discountAmount = getEligibleCouponDiscount(coupon, grossSubtotal);
        const isEligible = discountAmount > 0;
        const discountLabel = coupon.discountType === "percentage"
            ? `${coupon.discountValue}% off`
            : `Flat ₹${Number(coupon.discountValue).toFixed(2)} off`;

        let message = "Apply this coupon";
        if (!isEligible) {
            message = grossSubtotal < (coupon.minOrderAmount || 0)
                ? `Minimum purchase ₹${Number(coupon.minOrderAmount || 0).toFixed(2)} required`
                : "Not eligible for this cart";
        }

        return {
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            minOrderAmount: coupon.minOrderAmount || 0,
            maxDiscount: coupon.maxDiscount || null,
            expiresAt: coupon.expiresAt || null,
            usageLimit: coupon.usageLimit || null,
            discountLabel,
            potentialDiscount: Number(discountAmount).toFixed(2),
            isEligible,
            isApplied: appliedCouponCode === coupon.code,
            message
        };
    });
};

// Get cart data and clean invalid items
export const getCartData = async (userId) => {

    // Load full product details
    const cart = await Cart.findOne({ userId }).populate({
        path: 'items.productVariantId',
        populate: {
            path: 'productId',
            populate: { path: 'categoryId' }
        }
    });

    // If cart is empty
    if (!cart || !cart.items || cart.items.length === 0) {
        return {
            items: [],
            summary: {
                subtotal: 0,
                tax: 0,
                shipping: 0,
                discount: 0,
                offerSavings: 0,
                totalDiscount: 0,
                total: 0,
                totalItems: 0,
                originalGrossSubtotal: 0,
                grossSubtotal: 0
            },
            adjustments: [],
            appliedCoupon: null,
            availableCoupons: []
        };
    }

    let formattedItems = [];
    let adjustments = [];
    let cartModified = false;
    const offers = await getActiveOffers();

    // Loop through each item
    for (let item of cart.items) {

        const variant = item.productVariantId;
        const product = variant?.productId;
        const category = product?.categoryId;

        // Check status
        const isProductActive = product && product.status === 'active';
        const isVariantActive = variant && variant.status === 'active';
        const isCategoryActive = category && category.status !== 'inactive';
        const hasStock = variant && variant.stock > 0;

        if (isProductActive && isVariantActive && isCategoryActive && hasStock) {

            let actualQty = item.quantity;

            // Fix quantity if stock reduced
            if (actualQty > variant.stock) {
                actualQty = variant.stock;
                item.quantity = actualQty;
                adjustments.push(`${product.name} quantity reduced due to low stock`);
                cartModified = true;
            }

            const offerPricing = getBestOfferForTarget({
                productId: product._id,
                categoryId: category?._id,
                basePrice: Number(variant.price),
                offers
            });

            const appliedOffer = offerPricing.appliedOffer ? {
                ...offerPricing.appliedOffer,
                label: formatOfferLabel(offerPricing.appliedOffer)
            } : null;

            formattedItems.push({
                itemId: item._id,
                variantId: variant._id,
                productName: product.name,
                brand: product.brand,
                slug: product.slug,
                image: variant.images ? variant.images[0] : null,
                price: offerPricing.finalPrice,
                originalPrice: Number(variant.price),
                quantity: actualQty,
                stock: variant.stock,
                attributes: variant.attributes,
                itemTotal: (offerPricing.finalPrice * actualQty).toFixed(2),
                originalItemTotal: (Number(variant.price) * actualQty).toFixed(2),
                offerDiscount: Number((offerPricing.discountAmount * actualQty).toFixed(2)),
                appliedOffer,
                outOfStock: false,
                variant: variant
            });

        } else if (product) {
            // Remove invalid items
            adjustments.push(`${product.name} removed (not available)`);
            cartModified = true;
        }
    }

    // Save cleaned cart
    if (cartModified) {

        const activeVariantIds = formattedItems.map(f => f.variantId.toString());

        cart.items = cart.items.filter(item => {
            if (!item.productVariantId) return false;

            const currentId = item.productVariantId._id
                ? item.productVariantId._id.toString()
                : item.productVariantId.toString();

            return activeVariantIds.includes(currentId);
        });

        await cart.save();
    }

    const totalsWithoutDiscount = calculateCartTotals(formattedItems, 0);
    let appliedCoupon = null;
    let discountAmount = 0;
    let couponChanged = false;

    if (cart.appliedCoupon?.couponId) {
        const coupon = await Coupon.findById(cart.appliedCoupon.couponId);
        discountAmount = getEligibleCouponDiscount(coupon, Number(totalsWithoutDiscount.grossSubtotal));

        if (coupon && discountAmount > 0) {
            cart.appliedCoupon = {
                couponId: coupon._id,
                code: coupon.code,
                discountAmount
            };
            appliedCoupon = formatCouponForClient(cart.appliedCoupon);
        } else {
            clearAppliedCoupon(cart);
            couponChanged = true;
            adjustments.push("Applied coupon was removed because it is no longer valid for this cart");
        }
    }

    if (couponChanged) {
        await cart.save();
    }

    const availableCoupons = await buildAvailableCouponsForClient(
        Number(totalsWithoutDiscount.grossSubtotal),
        appliedCoupon?.code || null
    );

    return {
        items: formattedItems.reverse(),
        summary: calculateCartTotals(formattedItems, discountAmount),
        adjustments,
        appliedCoupon,
        availableCoupons
    };
};

// Update quantity of item
export const updateItemQuantity = async (userId, variantId, newQuantity) => {

    const variant = await ProductVariant.findById(variantId);

    // Validation
    if (!variant || variant.status !== 'active') throw new AppError("Item unavailable.", 404);
    if (newQuantity > variant.stock) throw new AppError(`Only ${variant.stock} left.`, 409);
    if (newQuantity > MAX_QTY_PER_ITEM) throw new AppError(`Limit is ${MAX_QTY_PER_ITEM}.`, 400);
    if (newQuantity < 1) throw new AppError("Quantity cannot be less than 1.", 400);

    const cart = await Cart.findOne({ userId });

    const itemIndex = cart.items.findIndex(
        item => item.productVariantId.toString() === variantId.toString()
    );

    if (itemIndex === -1) throw new AppError("Item not found.", 404);

    cart.items[itemIndex].quantity = newQuantity;

    await cart.save();

    return await getCartData(userId);
};

// Remove item from cart
export const removeCartItem = async (userId, variantId) => {

    const cart = await Cart.findOne({ userId });
    if (!cart) return;

    // Remove selected item
    cart.items = cart.items.filter(
        item => item.productVariantId.toString() !== variantId.toString()
    );

    await cart.save();

    return await getCartData(userId);
};

export const applyCouponToCart = async (userId, couponCode) => {
    if (!couponCode || !couponCode.trim()) {
        throw new AppError("Please enter a coupon code.", 400);
    }

    const normalizedCode = couponCode.trim().toUpperCase();
    const cart = await Cart.findOne({ userId });

    if (!cart || !cart.items?.length) {
        throw new AppError("Your cart is empty.", 400);
    }

    if (cart.appliedCoupon?.code) {
        if (cart.appliedCoupon.code === normalizedCode) {
            throw new AppError("This coupon is already applied.", 409);
        }

        throw new AppError("A coupon is already applied. Remove it before applying another one.", 409);
    }

    const coupon = await Coupon.findOne({ code: normalizedCode });

    if (!coupon || !coupon.isActive) {
        throw new AppError("Invalid or inactive coupon code.", 404);
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        throw new AppError("This coupon has expired.", 400);
    }

    const cartData = await getCartData(userId);
    const grossSubtotal = Number(cartData.summary.grossSubtotal || 0);
    const discountAmount = getEligibleCouponDiscount(coupon, grossSubtotal);

    if (!discountAmount) {
        if (grossSubtotal < (coupon.minOrderAmount || 0)) {
            throw new AppError(`Minimum order amount for this coupon is ₹${coupon.minOrderAmount.toFixed(2)}.`, 400);
        }

        throw new AppError("This coupon cannot be applied to your cart.", 400);
    }

    cart.appliedCoupon = {
        couponId: coupon._id,
        code: coupon.code,
        discountAmount
    };

    await cart.save();

    return await getCartData(userId);
};

export const removeCouponFromCart = async (userId) => {
    const cart = await Cart.findOne({ userId });

    if (!cart || !cart.appliedCoupon?.code) {
        throw new AppError("No coupon is currently applied.", 404);
    }

    clearAppliedCoupon(cart);
    await cart.save();

    return await getCartData(userId);
};

// Get all variant IDs in cart (for UI use)
export const getUserCartVariantIds = async (userId) => {
    if (!userId) return [];

    const cart = await Cart.findOne({ userId });
    if (!cart) return [];

    return cart.items.map(item => item.productVariantId.toString());
};

// Final check before checkout
export const validateCartAvailability = async (userId) => {

    const cart = await Cart.findOne({ userId }).populate('items.productVariantId');

    if (!cart || !cart.items || cart.items.length === 0) {
        throw new AppError("Your cart is empty.", 400);
    }

    let errors = [];

    for (const item of cart.items) {

        const variant = item.productVariantId;

        // If variant missing
        if (!variant) {
            errors.push("One item is no longer available.");
            continue;
        }

        const product = await Product.findById(variant.productId).populate('categoryId');

        // If product missing
        if (!product) {
            errors.push("A product has been removed.");
            continue;
        }

        const category = product.categoryId;

        // Check status step by step
        if (!category || category.status === 'inactive') {
            errors.push(`Category is not available.`);
        }
        else if (product.status !== 'active') {
            errors.push(`${product.name} is not available.`);
        }
        else if (variant.status !== 'active') {
            errors.push(`Selected variant is not available.`);
        }
        else if (variant.stock <= 0) {
            errors.push(`${product.name} is out of stock.`);
        }
        else if (item.quantity > variant.stock) {
            errors.push(`Only ${variant.stock} items available for ${product.name}.`);
        }
    }

    // If any problem found, show all errors
    if (errors.length > 0) {
        throw new AppError(errors.join('|'), 409);
    }

    return true;
};
