import nodemailer from "nodemailer";
import otpGenerator from "otp-generator";

export const generateOtp = () => {
    return otpGenerator.generate(4, {
        digits: true,
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false
    })
};

export const sendOtpEmail = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: `"Bella Beauty"<${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verify your Bella Beauty account",
        html: `
        <h2>Your OTP Code</h2>
        <p>Your verification code is :</p>
        <h1>${otp}</h1>
        <p>This code is valid for 1 minutes.</p>
        `
    };
    await transporter.sendMail(mailOptions);
};