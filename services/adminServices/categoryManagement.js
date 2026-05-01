import Category from "../../models/category.js";
import Attribute from "../../models/attribute.js";
import Product from "../../models/product.js";
import AppError from "../../utils/AppError.js";

// Pulls every single attribute (like Size, Color, Scent) from the database.
// The frontend uses this to generate the list of checkboxes so admins can choose 
// which specific traits apply to the category they are creating.
export const fetchAllAttributes = async () => {
    return await Attribute.find({}).sort({ label: 1 }).lean();
};

// Handles the heavy lifting of saving a brand new category.
// We have strict rules here to prevent the database from getting messy with duplicate data.
export const createNewCategory = async (categoryData) => {
    const { name, description, status, categoryImage, adminId, categoryAttributes } = categoryData;

    // Safety Check: Prevent case-sensitive duplicates. 
    // We don't want an admin creating "skincare" if "Skincare" already exists, 
    // as it would completely break the frontend filtering logic!
    const existingCategory = await Category.findOne({
        name: { $regex: new RegExp('^' + name.trim() + '$', 'i') }
    });

    if (existingCategory) {
        throw new AppError(`A category named "${name}" already exists.`, 409);
    }

    // Assemble the new category object
    const newCategory = new Category({
        name: name.trim(),
        description: description.trim(),
        status: status || 'active',
        categoryImage: categoryImage, 
        createdBy: adminId, 
        categoryAttributes: categoryAttributes || []
    });

    await newCategory.save();
    return newCategory;
};

// Acts as the engine for the admin's Category dashboard table.
// It simultaneously handles searching, filtering by active/inactive, and pagination.
export const fetchCategoriesWithFilter = async (status, search, page = 1, limit = 5) => {
    let filter = {};

    if (status && status !== 'all') {
        filter.status = status;
    }

    // If the admin typed something in the search bar, look for partial matches in the name
    if (search) {
        filter.name = { $regex: search, $options: "i" };
    }

    const skip = (page - 1) * limit;

    // We run the data fetch and the total count query at the exact same time (in parallel)
    // to cut the database wait time in half, making the admin panel feel much faster.
    const [categories, totalCategories] = await Promise.all([
        Category.find(filter)
            .sort({ createdAt: -1 }) // Always show the newest categories at the top
            .skip(skip)
            .limit(limit),
        Category.countDocuments(filter)
    ]);

    const categoryIds = categories.map(category => category._id);

    const productCounts = categoryIds.length
        ? await Product.aggregate([
            { $match: { categoryId: { $in: categoryIds } } },
            { $group: { _id: "$categoryId", productCount: { $sum: 1 } } }
        ])
        : [];

    const productCountMap = new Map(
        productCounts.map(item => [item._id.toString(), item.productCount])
    );

    const categoriesWithProductCount = categories.map(category => {
        const categoryObj = category.toObject();
        categoryObj.productCount = productCountMap.get(category._id.toString()) || 0;
        return categoryObj;
    });

    return { categories: categoriesWithProductCount, totalCategories };
};

// Executes our "soft delete" strategy.
// We never permanently delete a category because any products or old orders tied to it would break.
// Instead, we just flip its status back and forth.
export const toggleCategoryStatus = async (categoryId) => {
    const category = await Category.findById(categoryId);

    if (!category) {
        throw new AppError("Category not found", 404);
    }

    category.status = category.status === "active" ? "inactive" : "active";
    await category.save();

    return category.status;
};

// Reaches into the database to grab the exact details of a single category.
// The controller calls this so the frontend can pre-fill the "Edit Category" modal.
export const fetchCategoryById = async (categoryId) => {
    const category = await Category.findById(categoryId);
    if (!category) {
        throw new AppError("Category not found", 404);
    }
    return category;
};

// Processes updates when an admin edits an existing category.
// It handles collision checks, formats HTML form data, and safely processes new image uploads.
export const updateCategoryById = async (categoryId, bodyData, fileData) => {
    const { name, description, status } = bodyData;
    let categoryAttributes = bodyData.categoryAttributes || [];

    // HTML forms are tricky: checking one box sends a string, checking multiple sends an array.
    // We force it into an array here so Mongoose doesn't throw a schema error.
    if (!Array.isArray(categoryAttributes)) {
        categoryAttributes = [categoryAttributes];
    }

    // Safety Check: Ensure the admin didn't rename this category to match a DIFFERENT, existing category.
    // The `$ne` operator ensures we don't accidentally throw an error if they kept the name the same.
    const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp('^' + name.trim() + '$', 'i') },
        _id: { $ne: categoryId } 
    });

    if (existingCategory) {
        throw new AppError(`A different category named "${name.trim()}" already exists.`, 409);
    }

    const updateData = {
        name: name.trim(),
        description: description.trim(),
        status: status || 'inactive',
        categoryAttributes
    };

    // If the admin uploaded a new image, replace the old URL. 
    // If they didn't, we just leave the image property alone so the old image stays intact.
    if (fileData) {
        updateData.categoryImage = fileData.secure_url || fileData.path; 
    }

    // Apply the updates and return the newly modified document ({ new: true })
    const updatedCategory = await Category.findByIdAndUpdate(categoryId, updateData, { new: true });
    
    if (!updatedCategory) {
        throw new AppError("Failed to update category in the database.", 404);
    }
    
    return updatedCategory;
};
