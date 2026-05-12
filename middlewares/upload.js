import multer from "multer";
import "../config/env.js";
import { createRequire } from "module";

// Initialize 'require' to load CommonJS modules safely
const require = createRequire(import.meta.url);

// 1. Load the FULL Cloudinary library (not just v2)
const cloudinary = require("cloudinary");

// 2. Load the Storage Engine
const multerStorageCloudinary = require("multer-storage-cloudinary");
const CloudinaryStorage =
  multerStorageCloudinary.CloudinaryStorage ||
  multerStorageCloudinary.default ||
  multerStorageCloudinary;

// 3. Configure Cloudinary (using v2 explicitly)
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 4. Create Storage
const createStorage = (folderName) =>
  new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folderName,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [{ width: 500, height: 500, crop: "fill" }],
    },
  });

// NEW: Create a specific storage for Products without aggressive pre-cropping
// (Because we will crop them perfectly on the frontend using Cropper.js before uploading)
const createProductStorage = () =>
  new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "bella-beauty-products",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      // Keep the quality high, but prevent massive file sizes
      transformation: [{ width: 1200, crop: "limit" }],
    },
  });

export const uploadUser = multer({
  storage: createStorage("bella-beauty-users"),
});
export const uploadCategory = multer({
  storage: createStorage("bella-beauty-categories"),
});

// NEW: Export the product uploader
export const uploadProduct = multer({ storage: createProductStorage() });
