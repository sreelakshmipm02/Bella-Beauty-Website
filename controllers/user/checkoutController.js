import { getCartData } from "../../services/userServices/cartService.js";
import { getUserAddresses } from "../../services/userServices/userAddress.js";
import { processCheckout } from "../../services/userServices/orderService.js";

// 1. Render the Checkout Page
export const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        
        const cartData = await getCartData(userId);
        const addresses = await getUserAddresses(userId);

        // Extra safety: If cart is empty, redirect back to cart
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
        console.error("Checkout Page Error:", error);
        res.redirect("/cart");
    }
};

// 2. Handle the "Place Order" Button
export const placeOrderAjax = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { addressId, paymentMethod } = req.body;

        if (!addressId || !paymentMethod) {
            return res.status(400).json({ success: false, message: "Please select an address and payment method." });
        }

        // Process the transaction!
        const order = await processCheckout(userId, addressId, paymentMethod);

        // Send back a success response with the URL to their new receipt page
        res.json({ 
            success: true, 
            message: "Order placed successfully!",
            redirectUrl: `/order-success/${order._id}` // We will build this next!
        });

    } catch (error) {
        console.error("Place Order Error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};