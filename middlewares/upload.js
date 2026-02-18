import multer from "multer";
import dotenv from "dotenv";
import { createRequire } from "module";

// Initialize 'require' to load CommonJS modules safely
const require = createRequire(import.meta.url);

// 1. Load the FULL Cloudinary library (not just v2)
const cloudinary = require("cloudinary");

// 2. Load the Storage Engine
const multerStorageCloudinary = require("multer-storage-cloudinary");
const CloudinaryStorage = multerStorageCloudinary.CloudinaryStorage ||
    multerStorageCloudinary.default ||
    multerStorageCloudinary;

dotenv.config();

// 3. Configure Cloudinary (using v2 explicitly)
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// 4. Create Storage
const storage = new CloudinaryStorage({
    // We pass the WHOLE cloudinary object here. 
    // The library will internally call 'cloudinary.v2.uploader', which now exists.
    cloudinary: cloudinary,
    params: {
        folder: "bella-beauty-users",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [{ width: 500, height: 500, crop: "fill" }]
    }
});

export const upload = multer({ storage: storage });