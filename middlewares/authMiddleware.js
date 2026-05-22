import User from "../models/user.js";
import Cart from "../models/cart.js";
import Wishlist from "../models/wishlist.js";
import ProductVariant from "../models/productVariant.js";

const USER_SUSPENDED_MESSAGE =
  "Admin suspended your account. Please contact support.";
const USER_SUSPENDED_REDIRECT = "/login?reason=suspended";

const clearUserSession = (req) => {
  if (!req.session) return;

  delete req.session.userId;

  if (req.session.passport) {
    delete req.session.passport.user;
  }
};

const saveSessionIfPossible = (req, next) => {
  if (!req.session?.save) return next();
  req.session.save((err) => next(err));
};

const isProgrammaticRequest = (req) => {
  const secFetchMode = req.get("sec-fetch-mode");

  if (secFetchMode && secFetchMode !== "navigate") {
    return true;
  }

  if (req.xhr) return true;

  const acceptHeader = req.get("accept") || "";
  return acceptHeader.includes("application/json");
};

export const syncUserSessionStatus = async (req, res, next) => {
  if (!req.session?.userId) return next();

  try {
    const user = await User.findById(req.session.userId).select("status");

    if (!user) {
      clearUserSession(req);

      return saveSessionIfPossible(req, (saveError) => {
        if (saveError) return next(saveError);

        if (req.path.startsWith("/admin")) {
          return next();
        }

        if (isProgrammaticRequest(req)) {
          return res.status(401).json({
            success: false,
            message: "Your session has ended. Please log in again.",
            redirect: "/login",
          });
        }

        return res.redirect("/login");
      });
    }

    if (user.status === "suspended") {
      clearUserSession(req);

      return saveSessionIfPossible(req, (saveError) => {
        if (saveError) return next(saveError);

        if (req.path.startsWith("/admin")) {
          return next();
        }

        if (isProgrammaticRequest(req)) {
          return res.status(401).json({
            success: false,
            message: USER_SUSPENDED_MESSAGE,
            redirect: USER_SUSPENDED_REDIRECT,
          });
        }

        return res.redirect(USER_SUSPENDED_REDIRECT);
      });
    }

    next();
  } catch (error) {
    console.error("User Session Sync Error:", error);
    next();
  }
};

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
      const user = await User.findById(req.session.userId).select("status");

      if (!user) {
        clearUserSession(req);
        return res.redirect("/login");
      }

      if (user.status === "suspended") {
        clearUserSession(req);
        return res.redirect(USER_SUSPENDED_REDIRECT);
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
      const user = await User.findById(req.session.userId).select("status");
      if (!user) {
        clearUserSession(req);
        return res.status(401).json({
          success: false,
          message: "Your session has ended. Please log in again.",
          redirect: "/login",
        });
      }

      if (user.status === "suspended") {
        clearUserSession(req);
        return res.status(401).json({
          success: false,
          message: USER_SUSPENDED_MESSAGE,
          redirect: USER_SUSPENDED_REDIRECT,
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
