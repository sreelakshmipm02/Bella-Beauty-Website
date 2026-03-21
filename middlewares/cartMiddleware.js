import { getCartData } from "../services/userServices/cartService.js";

// This runs strictly before rendering the checkout page
export const verifyCartStockBeforeCheckout = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const cartData = await getCartData(userId);

        if (cartData.items.length === 0) {
            return res.redirect('/cart'); // Empty cart shouldn't reach checkout
        }

        let hasIssues = false;

        cartData.items.forEach(item => {
            if (item.outOfStock) hasIssues = true;
            // getCartData already auto-adjusted quantities > stock, so if it was out of stock, it flags it.
        });

        if (hasIssues) {
            // Flash a session message (if you use express-flash) or redirect with a query param
            return res.redirect('/cart?error=stock_issue');
        }

        // Everything is perfect, proceed to checkout page
        next();
    } catch (error) {
        console.error("Cart Middleware Error:", error);
        res.redirect('/cart');
    }
};