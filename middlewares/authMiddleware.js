import User from "../models/user.js";
import Cart from "../models/cart.js";
import Wishlist from "../models/wishlist.js";
import ProductVariant from "../models/productVariant.js";

/**
 * 1. Prevent Browser Caching
 * Ensures that sensitive pages (like checkout or admin dashboard) are
 * not stored in the browser's back-button cache.
 */
export const preventCache = (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
};

/**
 * 2. Protect Admin Routes
 * Strictly checks for the 'adminId' key. It ignores 'userId'.
 */
export const checkAdminSession = (req, res, next) => {
  if (req.session && req.session.adminId) {
    next();
  } else {
    // If an admin session isn't found, only redirect to admin login
    res.redirect("/admin/login");
  }
};

/**
 * 3. Protect User Routes (Standard Page Loads)
 * Checks for the 'userId' key. If the user is suspended, it removes
 * ONLY the userId, leaving adminId (if present) untouched.
 */
export const checkUserSession = async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);

      if (!user || user.status === "suspended") {
        // Targeted deletion to maintain session separation
        delete req.session.userId;
        return res.render("user/login", {
          error: "Session expired or account is suspended.",
        });
      }
      next();
    } catch (error) {
      console.error("User Session Check Error:", error);
      res.redirect("/login");
    }
  } else {
    res.redirect("/login");
  }
};

/**
 * 4. Protect Guest Routes
 * Redirects logged-in users away from Login/Signup pages.
 */
export const isGuest = (req, res, next) => {
  if (req.session && req.session.userId) {
    return res.redirect("/");
  }
  next();
};

/**
 * 5. Protect AJAX Routes
 * Same logic as checkUserSession but returns JSON instead of rendering pages.
 */
export const checkUserSessionAjax = async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      if (!user || user.status === "suspended") {
        delete req.session.userId;
        return res.status(401).json({
          success: false,
          message: "Session expired.",
          redirect: "/login",
        });
      }
      next();
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: "Please login to continue.",
      redirect: "/login",
    });
  }
};

/**
 * 6. Inject Cart Count
 * Fetches the current item count for the navbar badge.
 */
export const injectCartCount = async (req, res, next) => {
  res.locals.cartItemCount = 0;

  if (req.session && req.session.userId) {
    try {
      const cart = await Cart.findOne({ userId: req.session.userId });
      if (cart && cart.items) {
        res.locals.cartItemCount = cart.items.length;
      }
    } catch (error) {
      console.error("Cart Count Injection Error:", error);
    }
  }
  next();
};

/**
 * 7. Inject Wishlist Count
 * Fetches the current wishlist count. Uses optional chaining and
 * safety checks to prevent 'undefined' property crashes.
 */
export const injectWishlistCount = async (req, res, next) => {
  res.locals.wishlistCount = 0;

  if (req.session && req.session.userId) {
    try {
      const wishlist = await Wishlist.findOne({ userId: req.session.userId });

      // Check if wishlist exists and handle either 'items' or 'products' naming
      if (wishlist) {
        const list = wishlist.items || wishlist.products || [];
        const variantIds = list.map((item) => item.productVariantId).filter(Boolean);

        if (variantIds.length > 0) {
          const variants = await ProductVariant.find({ _id: { $in: variantIds } })
            .select("productId")
            .lean();

          const uniqueProductIds = new Set(
            variants
              .map((variant) => variant.productId?.toString())
              .filter(Boolean),
          );

          res.locals.wishlistCount = uniqueProductIds.size;
        }
      }
    } catch (error) {
      console.error("Wishlist Count Injection Error:", error);
    }
  }
  next();
};
