import { getCartData } from "../services/userServices/cartService.js";

/**
 * ---------------------------------------------------------
 * PRE-CHECKOUT GATEKEEPER MIDDLEWARE
 * ---------------------------------------------------------
 * This runs strictly before the checkout page is rendered.
 * It ensures the user's cart is valid and items are in stock
 * to prevent payment issues later in the flow.
 */
export const verifyCartStockBeforeCheckout = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const cartData = await getCartData(userId);

    // Fail-safe: An empty cart has no business being on the checkout page
    if (!cartData || cartData.items.length === 0) {
      return res.redirect("/cart");
    }

    let hasIssues = false;

    // The getCartData service already auto-adjusts quantities based on stock.
    // We just need to check if any item was flagged as completely unavailable.
    cartData.items.forEach((item) => {
      if (item.outOfStock) {
        hasIssues = true;
      }
    });

    // If there's a stock mismatch, bounce them back to the cart with a specific
    // error flag so the UI can show a 'Stock has changed' warning.
    if (hasIssues) {
      return res.redirect("/cart?error=stock_issue");
    }

    // All checks passed; move to the checkout controller
    next();
  } catch (error) {
    // Log the system error and fall back to the cart page for safety
    console.error("Cart Validation Middleware Error:", error);
    res.redirect("/cart");
  }
};
