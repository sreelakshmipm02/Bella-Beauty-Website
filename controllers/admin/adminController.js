import { authenticateAdmin } from "../../services/adminServices/adminAuth.js";
import { generateAdminResetToken, resetAdminPassword } from "../../services/adminServices/adminPassword.js";
import { toggleUserBlockStatus, fetchUsersWithFilter } from "../../services/adminServices/userManagement.js";

// Render Login Page
export const adminLoginPage = (req, res) => {
    if (req.session.adminId) {
        return res.redirect("/admin/dashboard");
    }
    res.render("admin/login", { error: null });
};

// Handle Login Submission
// Handle Login Submission
export const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Capture existing user session data before admin login
        const existingUserId = req.session.userId;

        // Call the service to handle logic
        const admin = await authenticateAdmin(email, password);

        // 2. Set the Admin ID
        req.session.adminId = admin._id;

        // 3. Re-attach the User ID if it existed
        if (existingUserId) {
            req.session.userId = existingUserId;
        }

        res.redirect("/admin/dashboard");

    } catch (error) {
        console.error("Admin Login Error:", error.message);
        res.render("admin/login", { error: error.message || "Something went wrong" });
    }
};

// Render Dashboard Page
export const dashboardPage = (req, res) => {
    res.render('admin/dashboard');
};

// 1. Render Forgot Password Page
export const adminForgotPasswordPage = (req, res) => {
    res.render("admin/forgot-password", { message: null, error: null });
};

// 2. Handle Email Submission
export const adminForgotPasswordSubmit = async (req, res) => {
    try {
        await generateAdminResetToken(req.body.email);
        res.render("admin/forgot-password", {
            message: "Reset link sent to your email.",
            error: null
        });
    } catch (error) {
        res.render("admin/forgot-password", { message: null, error: error.message });
    }
};

// 3. Render Reset Password Page
export const adminResetPasswordPage = (req, res) => {
    res.render("admin/reset-password", { token: req.params.token, error: null });
};

// 4. Handle New Password Submission
export const adminResetPasswordSubmit = async (req, res) => {
    try {
        await resetAdminPassword(req.params.token, req.body.password);
        res.render("admin/login", { error: null, message: "Password reset successful. Please login." });
    } catch (error) {
        res.render("admin/reset-password", { token: req.params.token, error: error.message });
    }
};

// Render user management page
export const userManagementPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5; // Users per page
        const { status, search } = req.query;

        const { users, totalUsers } = await fetchUsersWithFilter(status, search, page, limit);
        const totalPages = Math.ceil(totalUsers / limit);

        res.render('admin/user', {
            users,
            currentStatus: status || 'all',
            searchQuery: search || '', // Pass search text back to EJS 
            currentPage: page,
            totalPages,
            totalUsers,
            limit
        });
    } catch (error) {
        console.error("User Management Error:", error);
        res.status(500).send("Error fetching users");
    }
};

// Toggle user status (Block/Unblock)
export const toggleUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const newStatus = await toggleUserBlockStatus(userId);

        res.json({
            success: true,
            newStatus: newStatus
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Logout process 
export const adminLogout = (req, res) => {
    if (req.session) {
        // ONLY delete the admin key. userId remains untouched.
        delete req.session.adminId;
    }
    res.redirect('/admin/login');
};
