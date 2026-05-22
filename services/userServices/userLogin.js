import User from "../../models/user.js";
import bcrypt from "bcrypt";
import AppError from "../../utils/AppError.js";
// login user
export const loginUser = async (identifier, password) => {
  const user = await User.findOne({
    $or: [{ email: identifier }, { userName: identifier }],
  });

  if (!user) {
    throw new AppError("We couldn't find an account with those details.", 404);
  }

  // BLOCK CHECK
  if (user.status === "suspended") {
    throw new AppError(
      "Admin suspended your account. Please contact support.",
      403,
    );
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new AppError("The password you entered is incorrect.", 401);
  }
  return user;
};
