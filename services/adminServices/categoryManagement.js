import Category from "../../models/category.js";

/**
 * Fetches categories based on search, status filter, and pagination.
 * Fulfills constraints: Search (backend), Pagination (backend), Sort descending.
 */
export const fetchCategoriesWithFilter = async (status, search, page = 1, limit = 5) => {
    let filter = {};

    // 1. Apply Status Filter
    if (status && status !== 'all') {
        filter.status = status;
    }

    // 2. Apply Search Filter (Case-insensitive regex on the category name)
    if (search) {
        filter.name = { $regex: search, $options: "i" };
    }

    // 3. Calculate Pagination parameters
    const skip = (page - 1) * limit;
    
    // 4. Fetch data and total count in parallel
    // .sort({ createdAt: -1 }) ensures the descending order constraint
    const [categories, totalCategories] = await Promise.all([
        Category.find(filter)
            .sort({ createdAt: -1 }) // Descending order (newest first)
            .skip(skip)
            .limit(limit),
        Category.countDocuments(filter)
    ]);

    return { categories, totalCategories };
};

/**
 * Toggles a category's status between 'active' and 'inactive'.
 * Fulfills constraint: Soft Delete.
 */
export const toggleCategoryStatus = async (categoryId) => {
    const category = await Category.findById(categoryId);
    
    if (!category) {
        throw new Error("Category not found");
    }

    // Toggle between active and inactive for soft deletion
    category.status = category.status === "active" ? "inactive" : "active";
    await category.save();

    return category.status;
};