import { getCartData } from "../../services/userServices/cartService.js";
import { getUserAddresses } from "../../services/userServices/userAddress.js";
import { processCheckout } from "../../services/userServices/orderService.js";

// ---------------------------------------------------------
//  1. CHECKOUT PAGE
// ---------------------------------------------------------

/**
 * Show checkout page with cart items and user addresses.
 * If cart is empty, redirect back to cart page.
 */
export const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        
        // Get cart and address data
        const cartData = await getCartData(userId);
        const addresses = await getUserAddresses(userId);

        // If cart is empty, don't allow checkout
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
        // Log error and redirect safely
        console.error("Checkout Page Error:", error);
        res.redirect("/cart");
    }
};

// ---------------------------------------------------------
//  2. PLACE ORDER (AJAX)
// ---------------------------------------------------------

/**
 * Handle "Place Order" button click.
 * Returns a redirect URL instead of redirecting directly.
 */
export const placeOrderAjax = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { addressId, paymentMethod } = req.body;

        // Check required fields
        if (!addressId || !paymentMethod) {
            return res.status(400).json({ 
                success: false, 
                message: "Please select an address and payment method." 
            });
        }

        // Create order using service
        const order = await processCheckout(userId, addressId, paymentMethod);

        // Send success response with redirect URL
        res.json({ 
            success: true, 
            message: "Order placed successfully!",
            redirectUrl: `/order-success/${order._id}`
        });

    } catch (error) {
        // Send error to frontend
        console.error("Place Order Error:", error);
        res.status(400).json({ 
            success: false, 
            message: error.message || "Failed to process your order. Please try again." 
        });
    }
};