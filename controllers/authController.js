//google login
export const googleAuthCallback = (req, res) => {
  try {
    // Check status of the Google user
    if (req.user.status === "suspended") {
      return res.render("user/login", {
        error: "This Google account has been suspended."
      });
    }
    
    // Passport attaches the user to req.user
    req.session.userId = req.user._id;

    res.redirect("/");
  } catch (error) {
    console.error("Google Auth Callback Error:", error);
    res.redirect("/login");
  }
};
