import Category from "../../models/category.js";
import Attribute from "../../models/attribute.js";


// Fetch all available attributes for the checkbox list
export const fetchAllAttributes = async () => {
    return await Attribute.find({}).sort({ label: 1 }).lean();
};

//Creates a new category in the database. And Checks for duplicate names before saving.
export const createNewCategory = async (categoryData) => {
    const { name, description, status, categoryImage, adminId,categoryAttributes } = categoryData;

    // 1. Check for duplicates (Case-insensitive)
    // RegExp('^' + name + '$', 'i') ensures "Skincare" and "skincare" are treated as the same
    const existingCategory = await Category.findOne({
        name: { $regex: new RegExp('^' + name.trim() + '$', 'i') }
    });

    if (existingCategory) {
        throw new Error(`A category named "${name}" already exists.`);
    }

    // 2. Create the new category
    const newCategory = new Category({
        name: name.trim(),
        description: description.trim(),
        status: status || 'active',
        categoryImage: categoryImage, // Can be empty if no image was uploaded
        createdBy: adminId, // Fulfills the required createdBy schema field
        categoryAttributes: categoryAttributes || []
    });

    // 3. Save to database
    await newCategory.save();
    return newCategory;
};


//Fetches categories based on search, status filter, and pagination.
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


//Toggles a category's status between 'active' and 'inactive'.

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

// Fetch a single category by its ID
export const fetchCategoryById = async (categoryId) => {
    const category = await Category.findById(categoryId);
    if (!category) {
        throw new Error("Category not found");
    }
    return category;
};

// Update an existing category
export const updateCategoryById = async (categoryId, bodyData, fileData) => {
    const { name, description, status } = bodyData;
    let categoryAttributes = bodyData.categoryAttributes || [];

    // Ensure categoryAttributes is an array (even if only 1 box is checked)
    if (!Array.isArray(categoryAttributes)) {
        categoryAttributes = [categoryAttributes];
    }

    // 1. Check for duplicates (Case-insensitive AND excluding the current category)
    const existingCategory = await Category.findOne({ 
        name: { $regex: new RegExp('^' + name.trim() + '$', 'i') },
        _id: { $ne: categoryId } // $ne means "Not Equal" to the current ID
    });

    if (existingCategory) {
        throw new Error(`A different category named "${name.trim()}" already exists.`);
    }

    // 2. Format the data for the database
    const updateData = {
        name: name.trim(),
        description: description.trim(),
        status: status || 'inactive',
        categoryAttributes
    };

    // 3. Cloudinary Bulletproof Check
    if (fileData) {
        updateData.categoryImage = fileData.secure_url || fileData.path; 
    }

    // 4. Execute the database update
    const updatedCategory = await Category.findByIdAndUpdate(categoryId, updateData, { new: true });
    
    if (!updatedCategory) {
        throw new Error("Failed to update category in the database.");
    }
    
    return updatedCategory;
};