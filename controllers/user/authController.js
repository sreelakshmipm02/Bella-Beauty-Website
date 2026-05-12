import passport from "passport";

export const googleAuthCallback = (req, res, next) => {
  // 1. CAPTURE Admin ID before session rotation
  const existingAdminId = req.session.adminId;

  // 2. USE passport.authenticate correctly
  // If you still get an error, try: passport.default.authenticate
  const authenticator = passport.authenticate(
    "google",
    async (err, user, info) => {
      if (err || !user) {
        console.error("Google Auth Error:", err);
        return res.redirect("/login");
      }

      // 3. Log the user in
      req.logIn(user, async (loginErr) => {
        if (loginErr) return next(loginErr);

        // 4. PRESERVE both IDs in the fresh session
        req.session.userId = user._id;
        if (existingAdminId) {
          req.session.adminId = existingAdminId;
        }

        // 5. Status Check
        if (user.status === "suspended") {
          delete req.session.userId;
          return res.render("user/login", {
            error: "This Google account has been suspended.",
          });
        }

        // 6. Force Save session before redirect
        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          res.redirect("/");
        });
      });
    },
  );

  // Execute the authenticator
  authenticator(req, res, next);
};
