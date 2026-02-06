// 1. Prevent Browser Caching
export const preventCache = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
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
export const checkUserSession = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect("/login");
    }
};