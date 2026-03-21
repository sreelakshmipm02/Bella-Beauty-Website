import User from "../models/user.js";
import Cart from "../models/cart.js";

// 1. Prevent Browser Caching
export const preventCache = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
};

// 2. Protect Admin Routes
export const checkAdminSession = (req, res, next) => {
    if (req.session.adminId) {
        next();
    } else {
        res.redirect("/admin/login");
    }
};

// 3. Protect User Routes 
export const checkUserSession = async (req, res, next) => {
    if (req.session.userId) {
        const user = await User.findById(req.session.userId);

        // If user was blocked while logged in, destroy session
        if (!user || user.status === "suspended") {
            return req.session.destroy(() => res.render("user/login", { error: "session expired or account is suspended." }));
        }
        next();
    } else {
        res.redirect("/login");
    }
};

// 4. Protect Guest Routes (Login, Signup, etc.)
export const isGuest = (req, res, next) => {
    // If the user is already logged in, redirect them to the home page
    if (req.session.userId) {
        return res.redirect("/");
    }
    // If they are not logged in (they are a guest), let them proceed
    next();
};
//----------week3---------------------------
// Protect AJAX Routes (Cart, Wishlist)
export const checkUserSessionAjax = async (req, res, next) => {
    if (req.session.userId) {
        const user = await User.findById(req.session.userId);
        if (!user || user.status === "suspended") {
            req.session.destroy();
            return res.status(401).json({ success: false, message: "Session expired.", redirect: "/login" });
        }
        next();
    } else {
        return res.status(401).json({ success: false, message: "Please login to continue.", redirect: "/login" });
    }
};

// Global middleware to inject cart count into all EJS templates
export const injectCartCount = async (req, res, next) => {
    res.locals.cartItemCount = 0; // Default to 0
    
    if (req.session && req.session.userId) {
        try {
            const cart = await Cart.findOne({ userId: req.session.userId });
            if (cart) {
                res.locals.cartItemCount = cart.items.length;
            }
        } catch (error) {
            console.error("Cart Count Error:", error);
        }
    }
    next();
};