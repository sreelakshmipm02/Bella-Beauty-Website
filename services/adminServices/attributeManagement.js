import Attribute from "../../models/attribute.js";

export const createNewAttribute = async (data) => {
    // 1. Destructure
    const { displayLabel, internalName, dataType, possibleValues } = data;

    // 2. Check for existing attribute using internalName
    const existingAttr = await Attribute.findOne({ internalName: internalName.trim() });
    if (existingAttr) {
        throw new Error(`An attribute with the internal name "${internalName}" already exists.`);
    }

    let valuesArray = [];
    if ((dataType === 'enum' || dataType === 'array') && possibleValues) {
        valuesArray = possibleValues.split(',').map(val => val.trim()).filter(val => val.length > 0);
    }

    // 3. Save to database using the correct schema keys
    const newAttribute = new Attribute({
        displayLabel: displayLabel.trim(),
        internalName: internalName.trim(),
        dataType,
        possibleValues: valuesArray
    });

    await newAttribute.save();
    return newAttribute;
};

//
export const deleteAttributeById = async (attributeId) => {
    // Delete the attribute directly
    const result = await Attribute.findByIdAndDelete(attributeId);
    if (!result) {
        throw new Error("Attribute not found");
    }
    return result;
};

// Fetch single attribute by ID
export const fetchAttributeById = async (attributeId) => {
    const attribute = await Attribute.findById(attributeId);
    if (!attribute) throw new Error("Attribute not found");
    return attribute;
};

// Update existing attribute
export const updateAttributeById = async (attributeId, data) => {
    const { displayLabel, internalName, dataType, possibleValues } = data;

    // Check if the new internalName already exists on a DIFFERENT attribute
    const existingAttr = await Attribute.findOne({ 
        internalName: internalName.trim(), 
        _id: { $ne: attributeId } 
    });
    
    if (existingAttr) {
        throw new Error(`An attribute with the internal name "${internalName}" already exists.`);
    }

    let valuesArray = [];
    if ((dataType === 'enum' || dataType === 'array') && possibleValues) {
        valuesArray = possibleValues.split(',').map(val => val.trim()).filter(val => val.length > 0);
    }

    const updatedAttribute = await Attribute.findByIdAndUpdate(attributeId, {
        displayLabel: displayLabel.trim(),
        internalName: internalName.trim(),
        dataType,
        possibleValues: valuesArray
    }, { new: true });

    return updatedAttribute;
};