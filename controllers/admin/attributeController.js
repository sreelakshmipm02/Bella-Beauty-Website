import { createNewAttribute, deleteAttributeById, fetchAttributeById, updateAttributeById } from "../../services/adminServices/attributeManagement.js";

// Catches AJAX submissions from the Create Attribute modal.
// We pass the raw request body down to the service layer for validation and creation.
// Returning the newly created attribute object allows the frontend to instantly inject it into the UI without needing a page reload.
export const addAttributeSubmit = async (req, res) => {
    try {
        const newAttribute = await createNewAttribute(req.body);
        
        res.status(200).json({ 
            success: true, 
            message: "Attribute created successfully",
            attribute: newAttribute 
        });
    } catch (error) {
        console.error("Add Attribute Error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// Handles permanent deletion of an attribute.
// This is typically triggered by an admin cleaning up unused attributes, often during the category setup process.
// We rely on the service layer to handle the actual database removal before confirming success to the client.
export const deleteAttributeSubmit = async (req, res) => {
    try {
        const { id } = req.params;
        
        await deleteAttributeById(id);
        
        res.status(200).json({ 
            success: true, 
            message: "Attribute was permanently deleted." 
        });
    } catch (error) {
        console.error("Delete Attribute Error:", error);
        res.status(400).json({ 
            success: false, 
            message: error.message || "Failed to delete attribute." 
        });
    }
};

// Acts as an API endpoint to fetch a single attribute's data.
// The frontend calls this when opening the Edit Modal so it can pre-fill the form fields with the most up-to-date database values.
export const getAttributeForEdit = async (req, res) => {
    try {
        const attribute = await fetchAttributeById(req.params.id);
        res.status(200).json({ success: true, attribute });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

// Receives the modified attribute payload from the frontend.
// Passes the target ID and the new data to the service layer to overwrite the existing record in the database.
export const editAttributeSubmit = async (req, res) => {
    try {
        await updateAttributeById(req.params.id, req.body);
        res.status(200).json({ success: true, message: "Attribute updated successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};