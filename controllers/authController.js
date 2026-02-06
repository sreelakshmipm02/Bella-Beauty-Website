//google login
export const googleAuthCallback = (req, res) => {
  try {
    // Passport attaches the user to req.user
    req.session.userId = req.user._id;

    res.redirect("/");
  } catch (error) {
    console.error("Google Auth Callback Error:", error);
    res.redirect("/login");
  }
};
