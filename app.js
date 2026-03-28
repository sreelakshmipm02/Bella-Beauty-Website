import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import session from "express-session";
import passport from "passport";
import configurePassport from "./config/passport.js";
import MongoStore from "connect-mongo";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

// Import ProductVariant to count stock for the notification bell
import ProductVariant from "./models/productVariant.js"; 

// fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// connect to mongodb
connectDB(process.env.MONGO_URI);

// view engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// static files
app.use(express.static(path.join(__dirname, "public")));

// session setup
app.use(
    session({
        secret: process.env.SESSION_SECRET || "bella_secret_key",
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: "sessions"
        }),
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 // 1 day
        }
    })
);

// passport
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// ==========================================
// GLOBAL ADMIN NOTIFICATION MIDDLEWARE
// ==========================================
app.use(async (req, res, next) => {
    // We check if the URL starts with /admin so we don't waste 
    // database resources on the public-facing user side.
    if (req.path.startsWith('/admin')) {
        try {
            // Count items with stock lower than 10
            const count = await ProductVariant.countDocuments({ stock: { $lt: 10 } });
            res.locals.lowStockCount = count;
        } catch (err) {
            console.error("Global Middleware Error:", err);
            res.locals.lowStockCount = 0;
        }
    } else {
        // Fallback for non-admin routes
        res.locals.lowStockCount = 0;
    }
    next();
});

// routes
app.use("/", userRoutes);
app.use("/admin", adminRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).send("Page Not Found!");
});

export default app;