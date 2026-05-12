import nodemailer from "nodemailer";
import otpGenerator from "otp-generator";

export const generateOtp = () => {
  return otpGenerator.generate(4, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
};

export const sendOtpEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
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
        `,
  };
  await transporter.sendMail(mailOptions);
};

export const sendResetEmail = async (email, resetUrl) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender address
      to: email, // Receiver address
      subject: "Password Reset Request - Bella Beauty",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #E91E63; text-align: center;">Reset Your Password</h2>
            <p style="color: #333; font-size: 16px;">Hello,</p>
            <p style="color: #555; font-size: 16px;">
                We received a request to reset your password for your Bella Beauty account. 
                Click the button below to set a new password.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #E91E63; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                    Reset Password
                </a>
            </div>

            <p style="color: #777; font-size: 14px;">
                This link is valid for <strong>1 hour</strong>. If you didn't ask to reset your password, you can safely ignore this email.
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="text-align: center; color: #999; font-size: 12px;">
                © 2024 Bella Beauty. All rights reserved.
            </p>
        </div>
      `,
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    console.log(`Reset link sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending reset email:", error);
    throw new Error("Could not send reset email. Please try again later.");
  }
};
