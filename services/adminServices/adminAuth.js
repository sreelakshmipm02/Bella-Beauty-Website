import Admin from "../../models/admin.js";
import bcrypt from "bcrypt";
import "../../config/env.js";
import AppError from "../../utils/AppError.js";

export const authenticateAdmin = async (email, password) => {
  // 1. Check against .env credentials FIRST
  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    // Check if this super admin is already saved in MongoDB
    let admin = await Admin.findOne({ email: email });

    if (!admin) {
      // If not found in DB, auto-create the Super Admin now
      const hashedPassword = await bcrypt.hash(password, 10);

      admin = new Admin({
        email: email,
        password: hashedPassword,
        fullName: "Super Admin",
        phone: "0000000000",
      });

      await admin.save();
      console.log("Super Admin created in database from .env");
    }

    return admin;
  }

  // 2. If not .env admin, check Database for other sub-admins
  const admin = await Admin.findOne({ email: email });

  if (!admin) {
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = await bcrypt.compare(password, admin.password);

  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  return admin;
};
