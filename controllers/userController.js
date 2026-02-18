import {
    sendSignupOtp,
    verifySignupOtpService,
    resendOtpService

} from "../services/userServices/userSignup.js";
import { createUser } from "../services/userServices/createUser.js";
import { loginUser } from "../services/userServices/userLogin.js";
import { getUserData } from "../services/userServices/userAccount.js";
import {
    getUserAddresses,
    addNewAddress,
    updateAddress,
    deleteAddress,
    setAddressAsDefault
} from "../services/userServices/userAddress.js";
import {
    updateUserProfile,
    requestEmailUpdateOtp,
    completeEmailUpdate
} from "../services/userServices/editProfile.js";
//----------------------------------------------------------------------
//home page (index+home)
export const homePage = (req, res) => {
    const isLoggedIn = !!req.session.userId;

    res.render("user/home", { title: "Bella Beauty", isLoggedIn });
};

//----------------------------------------------------------------------
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

//resend signup otp
export const resendSignupOtp = async (req, res) => {
    try {
        const { email } = req.body;
        await resendOtpService(email);
        res.json({ success: true, message: "OTP resent successfully" });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

//----------------------------------------------------------------------
//get login page
export const loginPage = (req, res) => {
    if (req.session.userId) {
        return res.redirect("/");
    }
    res.render("user/login", { error: null });
};

//post login page
export const loginSubmit = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        const user = await loginUser(identifier, password);
        req.session.userId = user._id;
        res.redirect("/");


    } catch (error) {
        res.render("user/login", { error: error.message });
    }
};

//----------------------------------------------------------------------
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

// 1. UPDATE PROFILE
export const updateProfile = async (req, res) => {
    try {
        console.log("File received:", req.file); // <--- Add this debug line
        console.log("Body received:", req.body);

        const userId = req.session.userId;

        // --- THE FIX ---
        // Cloudinary puts the link in 'secure_url', not always in 'path'
        let filePath = undefined;
        if (req.file) {
            filePath = req.file.path || req.file.secure_url;
        }
        await updateUserProfile(userId, req.body, filePath);

        res.json({ success: true, message: "Profile updated successfully!" });
    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// 2. SEND OTP FOR EMAIL UPDATE
export const sendUpdateEmailOtp = async (req, res) => {
    try {
        const { newEmail } = req.body;

        await requestEmailUpdateOtp(newEmail);

        res.json({ success: true, message: "OTP sent to new email." });
    } catch (error) {
        console.error("OTP Error:", error.message);
        // Return success: false with the specific error message (e.g., "Email already in use")
        res.json({ success: false, message: error.message || "Failed to send OTP." });
    }
};

// 3. VERIFY OTP AND UPDATE EMAIL
export const verifyEmailUpdate = async (req, res) => {
    try {
        const { newEmail, otp } = req.body;
        const userId = req.session.userId;

        await completeEmailUpdate(userId, newEmail, otp);

        res.json({ success: true, message: "Email updated successfully!" });
    } catch (error) {
        // Return success: false with the specific error message (e.g., "Invalid OTP")
        res.json({ success: false, message: error.message || "Verification failed." });
    }
};
//----------------------------------------------------------------------
//user address page
export const addressPage = async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await getUserData(userId);
        const addresses = await getUserAddresses(userId);

        res.render("user/address", {
            title: "Manage Addresses",
            addresses: addresses || [], // Ensures addresses is never undefined
            user
        });
    } catch (error) {
        console.error("Address Page Error:", error);
        res.redirect("/account");
    }
}

// Add Address
export const addAddress = async (req, res) => {
    try {
        console.log("Received Data:", req.body); // Debugging line
        await addNewAddress(req.session.userId, req.body);
        res.json({ success: true, message: "Address added successfully" });
    } catch (error) {
        console.error("Add Address Error:", error); // See this in VS Code terminal
        res.status(400).json({ success: false, message: error.message });
    }
};

// Edit Address
export const editAddress = async (req, res) => {
    try {
        await updateAddress(req.params.addressId, req.session.userId, req.body);
        res.json({ success: true, message: "Address updated successfully" });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Delete Address
export const adressDelete = async (req, res) => {
    try {
        await deleteAddress(req.params.addressId, req.session.userId);
        res.json({ success: true, message: "Address deleted successfully" });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Set Default
export const setAsDefault = async (req, res) => {
    try {
        await setAddressAsDefault(req.params.addressId, req.session.userId);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

//----------------------------------------------------------------------
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