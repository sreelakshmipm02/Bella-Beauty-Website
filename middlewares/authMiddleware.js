import User from "../models/user.js";

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