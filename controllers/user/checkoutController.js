import { getCartData } from "../../services/userServices/cartService.js";
import { getUserAddresses } from "../../services/userServices/userAddress.js";
import {
  getRazorpayInstance,
  processCheckout,
  verifyPaymentSignature,
} from "../../services/userServices/orderService.js";
import { getWalletSnapshot } from "../../services/walletService.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import AppError from "../../utils/AppError.js";

// ---------------------------------------------------------
//  1. CHECKOUT PAGE
// ---------------------------------------------------------

/**
 * Show checkout page with cart items and user addresses.
 * If cart is empty, redirect back to cart page.
 */
export const getCheckoutPage = asyncHandler(async (req, res) => {
  const userId = req.session.userId;

  const cartData = await getCartData(userId);
  const addresses = await getUserAddresses(userId);
  const wallet = await getWalletSnapshot(userId, 5);
  const cartTotal = Number(cartData?.summary?.total || 0);

  if (!cartData || cartData.items.length === 0) {
    return res.redirect("/cart");
  }

  res.render("user/checkout", {
    title: "Checkout - Bella Beauty",
    isLoggedIn: true,
    cart: cartData,
    addresses: addresses || [],
    wallet: {
      ...wallet,
      isSufficient: wallet.balance >= cartTotal,
      shortfall: Number(Math.max(cartTotal - wallet.balance, 0).toFixed(2)),
    },
    razorpayEnabled: Boolean(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
    ),
  });
});

// ---------------------------------------------------------
//  2. PLACE ORDER (AJAX)
// ---------------------------------------------------------

/**
 * Handle "Place Order" button click.
 * Returns a redirect URL instead of redirecting directly.
 */
export const placeOrderAjax = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const { addressId, paymentMethod } = req.body;

  if (!addressId || !paymentMethod) {
    throw new AppError("Please select an address and payment method.", 400);
  }

  if (paymentMethod === "Online") {
    const cartData = await getCartData(userId);
    if (!cartData || cartData.items.length === 0)
      throw new AppError("Your cart is empty.", 400);

    // Create the Gateway Order (Amount must be in Paise, so multiply by 100)
    const options = {
      amount: Math.round(Number(cartData.summary.total) * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };
    const razorpayOrder = await getRazorpayInstance().orders.create(options);

    // Send this back to the frontend to trigger the popup
    return res.status(200).json({
      success: true,
      isOnline: true,
      razorpayOrderId: razorpayOrder.id,
      amount: options.amount,
      key: process.env.RAZORPAY_KEY_ID,
    });
  }

  // COD and Wallet can complete immediately on the backend
  const order = await processCheckout(userId, addressId, paymentMethod);

  res.status(201).json({
    success: true,
    message: "Order placed successfully!",
    orderId: order._id,
  });
});

//Verify the signature and save the order to MongoDB
export const verifyOnlinePayment = asyncHandler(async (req, res) => {
  const userId = req.session.userId;
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    addressId,
  } = req.body;

  const isValid = verifyPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  );

  if (!isValid)
    throw new AppError("Invalid payment signature. Payment failed.", 400);

  // Payment is verified! Now it is safe to clear the cart and reduce stock.
  const order = await processCheckout(
    userId,
    addressId,
    "Online",
    razorpay_payment_id,
  );

  res.status(200).json({
    success: true,
    message: "Payment verified and order placed!",
    orderId: order._id,
  });
});
