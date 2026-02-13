import User from "../../models/user.js";

// create user
export const createUser = async (userData) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    password,
    referralCode
  } = userData;

  // check existing user
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("Email already exists");
  }

  // generate username
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const userName = `${firstName.toLowerCase()}${randomNum}`;

  const user = new User({
  firstName,
  lastName,
  userName,
  email,
  phone,
  password,
  authProviders: {
    google: false,
    local: true //required
  }
});


  // optional referral code
  if (referralCode) {
    user.referralCode = referralCode;
  }

  return await user.save();
};

