import "./config/env.js";

import express from "express";
import path from "path";
import session from "express-session";
import passport from "passport";
import MongoStore from "connect-mongo";
import { fileURLToPath } from "url";

// Internal configurations and models
import configurePassport from "./config/passport.js";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { errorHandler, notFound } from "./middlewares/errorMiddleware.js";
import ProductVariant from "./models/productVariant.js";

// Since we are using ES Modules, we need to manually reconstruct __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Establish the database connection
connectDB(process.env.MONGO_URI);

// --- View Engine & Assets ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// --- Body Parsing ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Session Management ---
// Using MongoStore so sessions persist even if the server restarts
app.use(
  session({
    secret: process.env.SESSION_SECRET || "bella_secret_key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // Valid for 24 hours
    },
  }),
);

// --- Authentication (Passport) ---
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// --- Admin Alerts Middleware ---
// This middleware injects a 'lowStockCount' variable into all admin views.
// We only run the DB query on /admin routes to keep the public site snappy.
app.use(async (req, res, next) => {
  if (req.path.startsWith("/admin")) {
    try {
      const count = await ProductVariant.countDocuments({ stock: { $lt: 10 } });
      res.locals.lowStockCount = count;
    } catch (err) {
      console.error("Failed to fetch low stock count:", err);
      res.locals.lowStockCount = 0;
    }
  } else {
    res.locals.lowStockCount = 0;
  }
  next();
});

// --- Route Definitions ---
app.use("/", userRoutes);
app.use("/admin", adminRoutes);

// --- Error Handling ---
app.use(notFound);
app.use(errorHandler);

export default app;
