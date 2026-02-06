import {
    sendSignupOtp,
    verifySignupOtpService

} from "../services/userServices/userSignup.js";
import { createUser } from "../services/userServices/createUser.js";
import { loginUser } from "../services/userServices/userLogin.js";
import { generateResetToken, resetUserPassword } from "../services/userServices/userPassword.js";

//home page (index+home)
export const homePage = (req, res) => {
    const isLoggedIn = !!req.session.userId;

    res.render("user/home", { title: "Bella Beauty", isLoggedIn });
};

//get signup page
export const signupPage = (req, res) => {
    res.render("user/signup", { error: null });
};

//send signup otp
export const sendSignupOtpController = async (req, res) => {
    try {
        const { email } = req.body;

        await sendSignupOtp(email, req.body);

        res.json({
            success: true,
            message: "OTP sent to email"
        });
    } catch (error) {
        console.error("OTP ERROR:", error.message);

        res.json({
            success: false,
            message: error.message
        });
    }
};

// verify otp
export const verifySignupOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const userData = await verifySignupOtpService(email, otp);

        await createUser(userData);

        res.json({ success: true });

    } catch (error) {
        console.error("SIGNUP ERROR:", error);
        res.json({ success: false, message: error.message });
    }
};
//get login page
export const loginPage = (req, res) => {
    if (req.session.userId) {
        return res.redirect("/home");
    }
    res.render("user/login", { error: null });
};

//post login page
export const loginSubmit = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        const user = await loginUser(identifier, password);
        req.session.userId = user._id;
        res.redirect("/home");


    } catch (error) {
        res.render("user/login", { error: error.message });
    }
};

// Render Forgot Password Page
export const forgotPasswordPage = (req, res) => {
    res.render("user/forgot-password", { message: null, error: null });
};

// Handle Forgot Password Form
export const forgotPasswordSubmit = async (req, res) => {
    try {
        await generateResetToken(req.body.email);
        res.render("user/forgot-password", {
            message: "A reset link has been sent to your email.",
            error: null
        });
    } catch (error) {
        res.render("user/forgot-password", { message: null, error: error.message });
    }
};

// Render Reset Password Page (from email link)
export const resetPasswordPage = (req, res) => {
    res.render("user/reset-password", { token: req.params.token, error: null });
};

// Handle New Password Submission
export const resetPasswordSubmit = async (req, res) => {
    try {
        await resetUserPassword(req.params.token, req.body.password);
        res.render("user/login", { error: null, message: "Password reset successful. Please login." });
    } catch (error) {
        res.render("user/reset-password", { token: req.params.token, error: error.message });
    }
};