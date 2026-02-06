import {
    sendSignupOtp,
    verifySignupOtpService

} from "../services/userServices/userSignup.js";
import { createUser } from "../services/userServices/createUser.js";
import { loginUser } from "../services/userServices/userLogin.js";
import { getUserData } from "../services/userServices/userAccount.js";

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

//render user account page
export const userAccount = async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await getUserData(userId);
        res.render("user/account", { 
            title: "My Account",
            user: user 
        });
    } catch (error) {
        console.error("Account Page Error:", error);
        res.redirect("/login");
    }
};

// Logout process 
export const userLogout = (req, res) => {
    // 1. Destroy the session
    req.session.destroy((err) => {
        if (err) {
            console.log("Error destroying session:", err);
            return res.redirect("/");
        }

        // 2. Clear the cookie 
        res.clearCookie("connect.sid");

        // 3. Redirect to Login
        res.redirect("/login");
    });
};