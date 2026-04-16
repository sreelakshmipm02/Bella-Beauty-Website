import Attribute from "../../models/attribute.js";
import AppError from "../../utils/AppError.js";

// Handles the core business logic for creating a brand new dynamic attribute (like Size or Color).
// This function acts as a gatekeeper to ensure we don't create duplicate attributes 
// and correctly formats comma-separated text into neat arrays for the database.
export const createNewAttribute = async (data) => {
    const { displayLabel, internalName, dataType, possibleValues } = data;

    // Safety Check: We strictly prevent multiple attributes from sharing the same internal name
    // to avoid confusing the database or the frontend when linking them to products.
    const existingAttr = await Attribute.findOne({ internalName: internalName.trim() });
    if (existingAttr) {
        throw new AppError(`An attribute with the internal name "${internalName}" already exists.`, 409);
    }

    // If the attribute requires specific options (like Red, Blue, Green for an "enum"), 
    // we take the raw comma-separated string from the form and split it into a clean JavaScript array.
    let valuesArray = [];
    if ((dataType === 'enum' || dataType === 'array') && possibleValues) {
        valuesArray = possibleValues.split(',').map(val => val.trim()).filter(val => val.length > 0);
    }

    const newAttribute = new Attribute({
        displayLabel: displayLabel.trim(),
        internalName: internalName.trim(),
        dataType,
        possibleValues: valuesArray
    });

    await newAttribute.save();
    return newAttribute;
};

// Permanently erases an attribute from the database.
// This is a hard delete, meaning it's completely wiped out, so it should generally 
// only be used for cleaning up unused or accidental attributes.
export const deleteAttributeById = async (attributeId) => {
    const result = await Attribute.findByIdAndDelete(attributeId);
    if (!result) {
        throw new AppError("Attribute not found", 404);
    }
    return result;
};

// Reaches into the database to grab the exact details of a single attribute.
// The controller usually calls this so the frontend can pre-fill an "Edit Attribute" modal.
export const fetchAttributeById = async (attributeId) => {
    const attribute = await Attribute.findById(attributeId);
    if (!attribute) throw new AppError("Attribute not found", 404);
    return attribute;
};

// Processes updates when an admin edits an existing attribute.
// It performs a crucial collision check to make sure the admin didn't rename this attribute 
// to an internal name that another attribute is already using.
export const updateAttributeById = async (attributeId, data) => {
    const { displayLabel, internalName, dataType, possibleValues } = data;

    // Safety Check: Does this new internal name belong to a DIFFERENT attribute (_id: { $ne: attributeId })?
    const existingAttr = await Attribute.findOne({ 
        internalName: internalName.trim(), 
        _id: { $ne: attributeId } 
    });
    
    if (existingAttr) {
        throw new AppError(`An attribute with the internal name "${internalName}" already exists.`, 409);
    }

    // Re-process the possible values into a clean array, just in case the admin added or removed options
    let valuesArray = [];
    if ((dataType === 'enum' || dataType === 'array') && possibleValues) {
        valuesArray = possibleValues.split(',').map(val => val.trim()).filter(val => val.length > 0);
    }

    // Update the document in MongoDB and return the freshly updated version ({ new: true })
    const updatedAttribute = await Attribute.findByIdAndUpdate(attributeId, {
        displayLabel: displayLabel.trim(),
        internalName: internalName.trim(),
        dataType,
        possibleValues: valuesArray
    }, { new: true });

    if (!updatedAttribute) {
        throw new AppError("Attribute not found", 404);
    }

    return updatedAttribute;
};
