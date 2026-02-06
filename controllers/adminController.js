import { authenticateAdmin } from "../services/adminServices/adminAuth.js";
import { generateAdminResetToken, resetAdminPassword } from "../services/adminServices/adminPassword.js";

// Render Login Page
export const adminLoginPage = (req, res) => {
    if (req.session.adminId) {
        return res.redirect("/admin/dashboard");
    }
    res.render("admin/login", { error: null });
};

// Handle Login Submission
export const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Call the service to handle logic
        const admin = await authenticateAdmin(email, password);

        // If successful (no error thrown), set session and redirect
        req.session.adminId = admin._id;
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