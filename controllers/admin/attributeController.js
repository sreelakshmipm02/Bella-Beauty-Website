import { createNewAttribute, deleteAttributeById, fetchAttributeById, updateAttributeById } from "../../services/adminServices/attributeManagement.js";
import { asyncHandler } from "../../middlewares/asyncHandler.js";

// Catches AJAX submissions from the Create Attribute modal.
// We pass the raw request body down to the service layer for validation and creation.
// Returning the newly created attribute object allows the frontend to instantly inject it into the UI without needing a page reload.
export const addAttributeSubmit = asyncHandler(async (req, res) => {
    const newAttribute = await createNewAttribute(req.body);

    res.status(201).json({ 
        success: true, 
        message: "Attribute created successfully",
        attribute: newAttribute 
    });
});

// Handles permanent deletion of an attribute.
// This is typically triggered by an admin cleaning up unused attributes, often during the category setup process.
// We rely on the service layer to handle the actual database removal before confirming success to the client.
export const deleteAttributeSubmit = asyncHandler(async (req, res) => {
    const { id } = req.params;

    await deleteAttributeById(id);

    res.status(200).json({ 
        success: true, 
        message: "Attribute was permanently deleted." 
    });
});

// Acts as an API endpoint to fetch a single attribute's data.
// The frontend calls this when opening the Edit Modal so it can pre-fill the form fields with the most up-to-date database values.
export const getAttributeForEdit = asyncHandler(async (req, res) => {
    const attribute = await fetchAttributeById(req.params.id);
    res.status(200).json({ success: true, attribute });
});

// Receives the modified attribute payload from the frontend.
// Passes the target ID and the new data to the service layer to overwrite the existing record in the database.
export const editAttributeSubmit = asyncHandler(async (req, res) => {
    await updateAttributeById(req.params.id, req.body);
    res.status(200).json({ success: true, message: "Attribute updated successfully." });
});
