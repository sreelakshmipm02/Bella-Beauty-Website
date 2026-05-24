import passport from "passport";

const USER_SUSPENDED_REDIRECT = "/login?reason=suspended";
const DEFAULT_GOOGLE_CALLBACK_PATH = "/auth/google/callback";

const clearUserSession = (req) => {
  if (!req.session) return;

  delete req.session.userId;

  if (req.session.passport) {
    delete req.session.passport.user;
  }
};

const getForwardedHeaderValue = (req, headerName) =>
  req
    .get(headerName)
    ?.split(",")[0]
    ?.trim();

const getRequestOrigin = (req) => {
  const protocol = getForwardedHeaderValue(req, "x-forwarded-proto") || req.protocol;
  const host = getForwardedHeaderValue(req, "x-forwarded-host") || req.get("host");

  return `${protocol}://${host}`;
};

const getGoogleCallbackPath = () => {
  const configuredCallback = process.env.GOOGLE_CALLBACK_URL?.trim();

  if (!configuredCallback) {
    return DEFAULT_GOOGLE_CALLBACK_PATH;
  }

  try {
    const parsedCallback = new URL(configuredCallback);
    return `${parsedCallback.pathname}${parsedCallback.search}`;
  } catch {
    return configuredCallback.startsWith("/")
      ? configuredCallback
      : DEFAULT_GOOGLE_CALLBACK_PATH;
  }
};

const getGoogleCallbackUrl = (req) =>
  new URL(getGoogleCallbackPath(), getRequestOrigin(req)).toString();

export const startGoogleAuth = (req, res, next) => {
  const authOptions = {
    scope: ["profile", "email"],
    callbackURL: getGoogleCallbackUrl(req),
  };

  if (req.query.prompt === "select_account") {
    authOptions.prompt = "select_account";
  }

  return passport.authenticate("google", authOptions)(req, res, next);
};

export const googleAuthCallback = (req, res, next) => {
  // 1. CAPTURE Admin ID before session rotation
  const existingAdminId = req.session.adminId;

  // 2. USE passport.authenticate correctly
  // If you still get an error, try: passport.default.authenticate
  const authenticator = passport.authenticate(
    "google",
    { callbackURL: getGoogleCallbackUrl(req) },
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
          clearUserSession(req);

          return req.session.save((saveErr) => {
            if (saveErr) return next(saveErr);
            return res.redirect(USER_SUSPENDED_REDIRECT);
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
