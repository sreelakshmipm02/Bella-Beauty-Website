import { getCartData } from "../../services/userServices/cartService.js";
import { getUserAddresses } from "../../services/userServices/userAddress.js";
import { processCheckout } from "../../services/userServices/orderService.js";
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

    if (!cartData || cartData.items.length === 0) {
        return res.redirect("/cart");
    }

    res.render("user/checkout", {
        title: "Checkout - Bella Beauty",
        isLoggedIn: true,
        cart: cartData,
        addresses: addresses || []
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

    const order = await processCheckout(userId, addressId, paymentMethod);

    res.status(201).json({ 
        success: true, 
        message: "Order placed successfully!",
        redirectUrl: `/order-success/${order._id}`
    });
});
