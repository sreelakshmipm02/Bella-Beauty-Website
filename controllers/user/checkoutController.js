import { getCartData } from "../../services/userServices/cartService.js";
import { getUserAddresses } from "../../services/userServices/userAddress.js";
import { processCheckout } from "../../services/userServices/orderService.js";

// ---------------------------------------------------------
//  1. CHECKOUT VIEW RENDERING
// ---------------------------------------------------------

/**
 * Renders the checkout screen with the user's current cart and saved addresses.
 * Includes a safety redirect to prevent users from accessing checkout with an empty cart.
 */
export const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        
        // Parallel data fetching could be done here, but sequential is fine for now
        const cartData = await getCartData(userId);
        const addresses = await getUserAddresses(userId);

        // Fail-safe: If the cart is empty (e.g., they hit 'back' after an order), 
        // we bounce them to the cart page instead of showing a blank checkout.
        if (!cartData || cartData.items.length === 0) {
            return res.redirect("/cart");
        }

        res.render("user/checkout", {
            title: "Checkout - Bella Beauty",
            isLoggedIn: true,
            cart: cartData,
            addresses: addresses || []
        });
    } catch (error) {
        // Log the error for server-side debugging and exit to a safe page
        console.error("Checkout Page Error:", error);
        res.redirect("/cart");
    }
};

// ---------------------------------------------------------
//  2. ORDER PROCESSING (AJAX)
// ---------------------------------------------------------

/**
 * Finalizes the purchase when the "Place Order" button is clicked.
 * Since this is an AJAX call, we return a redirectUrl instead of 
 * using res.redirect() directly.
 */
export const placeOrderAjax = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { addressId, paymentMethod } = req.body;

        // Basic validation before hitting the service layer
        if (!addressId || !paymentMethod) {
            return res.status(400).json({ 
                success: false, 
                message: "Please select an address and payment method." 
            });
        }

        // The service layer handles inventory deduction and order creation
        const order = await processCheckout(userId, addressId, paymentMethod);

        // We send a success flag so the frontend can handle the final redirect 
        // or show a success animation.
        res.json({ 
            success: true, 
            message: "Order placed successfully!",
            redirectUrl: `/order-success/${order._id}`
        });

    } catch (error) {
        // We pass the specific error (e.g., "Out of Stock") back to the user
        console.error("Place Order Error:", error);
        res.status(400).json({ 
            success: false, 
            message: error.message || "Failed to process your order. Please try again." 
        });
    }
};