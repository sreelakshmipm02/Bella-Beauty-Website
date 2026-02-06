import { authenticateAdmin } from "../services/adminServices/adminAuth.js";

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