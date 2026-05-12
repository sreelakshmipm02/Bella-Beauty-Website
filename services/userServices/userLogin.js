import User from "../../models/user.js";
import bcrypt from "bcrypt";
import AppError from "../../utils/AppError.js";
// login user
export const loginUser = async (identifier, password) => {
  const user = await User.findOne({
    $or: [{ email: identifier }, { userName: identifier }],
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // BLOCK CHECK
  if (user.status === "suspended") {
    throw new AppError("Your account has been suspended by the admin.", 403);
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new AppError("Invalid password", 401);
  }
  return user;
};
