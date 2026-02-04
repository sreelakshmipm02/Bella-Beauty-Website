import User from "../../models/user.js";
import bcrypt from "bcrypt";
// login user
export const loginUser = async (identifier, password) => {
  const user = await User.findOne({
    $or: [
      { email: identifier },
      { userName: identifier }
    ]
  });

  if (!user) {
    throw new Error("User not found");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Invalid password");
  }
  return user;
};
