import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.js";

export default function configurePassport() {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // extract email from Google profile
                    const email = profile.emails[0].value;
                    const firstName = profile.name.givenName;
                    const lastName = profile.name.familyName;

                    let user = await User.findOne({ email });

                    if (!user) {
                        // generate username
                        const randomNum = Math.floor(1000 + Math.random() * 9000);
                        const userName = `${firstName.toLowerCase()}${randomNum}`;

                        user = await User.create({
                            email,
                            firstName,
                            lastName,
                            userName,
                            password: null,
                            authProviders: {
                                google: true,
                                local: false
                            }
                        });
                    } else {
                        // link existing user to google
                        user.authProviders = user.authProviders || {};
                        user.authProviders.google = true;

                        if (user.authProviders.local !== true) {
                            user.authProviders.local = false;
                        }

                        await user.save();
                    }

                    return done(null, user);

                } catch (error) {
                    return done(error, null);
                }
            }
        )
    );

    // session handling
    passport.serializeUser((user, done) => {
        // Only serialize the ID
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            // Only attempt to find a User if this isn't an admin-only session
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });

}