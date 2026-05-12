import Product from "../../models/product.js";
import Category from "../../models/category.js";
import ProductVariant from "../../models/productVariant.js";
import mongoose from "mongoose";
import AppError from "../../utils/AppError.js";

// Acts as the engine for the Admin Product Dashboard table.
// It builds a powerful MongoDB aggregation pipeline to simultaneously apply search filters,
// pagination, and calculate the total available stock across all of a product's variants.
export const getAdminProductsList = async (
  page,
  limit,
  search,
  category,
  status,
) => {
  const skip = (page - 1) * limit;
  let matchQuery = {};

  // If the admin types in the search bar, look for partial matches in both name and brand
  if (search) {
    matchQuery.$or = [
      { name: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
    ];
  }

  // Apply exact match filters if the admin used the dropdowns
  if (status && status !== "all") matchQuery.status = status;
  if (category && category !== "all")
    matchQuery.categoryId = new mongoose.Types.ObjectId(category);

  const totalProducts = await Product.countDocuments(matchQuery);

  const products = await Product.aggregate([
    { $match: matchQuery },
    { $sort: { createdAt: -1 } }, // Always show newest products at the top
    { $skip: skip },
    { $limit: limit },
    // Pull in the actual category name so the table doesn't just show a raw ObjectId
    {
      $lookup: {
        from: "categories",
        localField: "categoryId",
        foreignField: "_id",
        as: "categoryDetails",
      },
    },
    // preserveNullAndEmptyArrays prevents the pipeline from crashing if a category was somehow hard-deleted
    { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },
    // Pull in all variants so we can add up their individual stock levels into one master "totalStock" number
    {
      $lookup: {
        from: "productvariants",
        localField: "_id",
        foreignField: "productId",
        as: "variants",
      },
    },
    { $addFields: { totalStock: { $sum: "$variants.stock" } } },
  ]);

  return { products, totalProducts };
};

// Fetches a quick list of categories to populate dropdown menus on the Add/Edit Product pages.
// We only fetch 'active' categories to prevent admins from assigning products to hidden categories.
export const getActiveCategories = async () => {
  return await Category.find({ status: "active" }).sort({ name: 1 });
};

// Executes our "soft delete" strategy for products.
// We never permanently delete products because old customer order histories rely on this data.
// We just flip the status back and forth to hide or show it on the storefront.
export const toggleProductStatusById = async (productId) => {
  const product = await Product.findById(productId);
  if (!product) throw new AppError("Product not found", 404);

  product.status = product.status === "active" ? "inactive" : "active";
  await product.save();
  return product.status;
};

// Handles the complex process of creating a parent Product and tying multiple child Variants to it.
export const createNewProduct = async (productData, variantsData, files) => {
  const { name, brand, categoryId, description, productType } = productData;

  // Automatically generate a clean, URL-friendly slug (e.g., "radiant-glow-serum")
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  const finalDescription = description.trim() === "" ? undefined : description;

  // 1. Save the foundational Base Product first so we get an _id to link the variants to
  const newProduct = new Product({
    name,
    brand,
    productType,
    description: finalDescription,
    categoryId,
    slug,
    status: "active",
  });
  const savedProduct = await newProduct.save();

  // 2. Loop through the array of variants sent from the frontend UI
  for (let i = 0; i < variantsData.length; i++) {
    const variantData = variantsData[i];

    // Because the admin uploads all images at once, we use the specific fieldname (e.g., variant_images_0)
    // to figure out exactly which Cloudinary URLs belong to this specific variant.
    const variantImages = files
      .filter((file) => file.fieldname === `variant_images_${i}`)
      .map((file) => file.path || file.secure_url);

    const newVariant = new ProductVariant({
      productId: savedProduct._id,
      sku: variantData.sku,
      price: variantData.price,
      stock: variantData.stock,
      attributes: variantData.attributes,
      images: variantImages,
    });
    await newVariant.save();
  }
};

// Gathers the entire product ecosystem (the base details AND all its variants)
// so the frontend can perfectly reconstruct the product in the Edit UI.
export const getProductDataForEdit = async (productId) => {
  const product = await Product.findById(productId);
  if (!product) throw new AppError("Product not found", 404);

  const variants = await ProductVariant.find({ productId: product._id });
  return { product, variants };
};

// This is the heaviest function in the file. It reconciles the differences between
// what is currently in the database and what the admin just submitted in the Edit form.
export const updateExistingProduct = async (
  productId,
  productData,
  variantsData,
  files,
) => {
  const { name, brand, description, productType } = productData;

  const finalDescription = description.trim() === "" ? undefined : description;

  // We regenerate the slug just in case the admin decided to change the product's name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  // 1. Apply the text updates to the Base Product
  await Product.findByIdAndUpdate(productId, {
    name,
    slug,
    brand,
    productType,
    description: finalDescription,
  });

  // We keep a running list of the variants the admin kept or added.
  // Anything NOT on this list at the end gets deleted from the database.
  const activeVariantIds = [];

  // 2. Process each variant from the submitted form
  for (let i = 0; i < variantsData.length; i++) {
    const variant = variantsData[i];

    // Start with the Cloudinary URLs the variant already had from before
    let finalImages = variant.images || [];

    // If the admin uploaded NEW images for this specific variant, add them to the array
    if (files) {
      const newFilesForVariant = files.filter(
        (f) => f.fieldname === `variant_images_${i}`,
      );
      if (newFilesForVariant.length > 0) {
        const newImageUrls = newFilesForVariant.map(
          (file) => file.path || file.secure_url || file.url,
        );
        const validUrls = newImageUrls.filter((url) => url != null);
        finalImages.push(...validUrls);
      }
    }

    // Safety Catch: Prevent saving if the final image count falls below your store's requirement
    if (finalImages.length < 3) {
      throw new AppError(
        `Variant ${variant.sku || i} requires at least 3 images.`,
        422,
      );
    }

    if (variant._id) {
      // Scenario A: The variant already existed, so we just update its details and images
      await ProductVariant.findByIdAndUpdate(variant._id, {
        sku: variant.sku,
        price: variant.price,
        stock: variant.stock,
        attributes: variant.attributes,
        images: finalImages,
      });
      activeVariantIds.push(variant._id);
    } else {
      // Scenario B: The admin clicked "Add Variant" while editing, so we create a brand new document
      const newVariant = await ProductVariant.create({
        productId: productId,
        sku: variant.sku,
        price: variant.price,
        stock: variant.stock,
        attributes: variant.attributes,
        images: finalImages,
      });
      activeVariantIds.push(newVariant._id);
    }
  }

  // 3. The Cleanup Phase:
  // If a variant ID is in the database for this product, but IS NOT in our 'activeVariantIds' list,
  // it means the admin hit the 'Delete' trash can icon in the UI. We remove it from the database here.
  await ProductVariant.deleteMany({
    productId: productId,
    _id: { $nin: activeVariantIds },
  });
};
