import { createNewAttribute,deleteAttributeById,fetchAttributeById,updateAttributeById } from "../../services/adminServices/attributeManagement.js";
// Handle POST request from the Create Attribute Modal (AJAX)
export const addAttributeSubmit = async (req, res) => {
    try {
        // Call the service and capture the newly created document
        const newAttribute = await createNewAttribute(req.body);
        
        // Return success along with the new attribute data for the frontend to render
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

//delete attributes at category creation
export const deleteAttributeSubmit = async (req, res) => {
    try {
        const { id } = req.params;
        
        await deleteAttributeById(id);
        
        // Send the confirmation message back to the frontend
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

export const getAttributeForEdit = async (req, res) => {
    try {
        const attribute = await fetchAttributeById(req.params.id);
        res.status(200).json({ success: true, attribute });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

export const editAttributeSubmit = async (req, res) => {
    try {
        await updateAttributeById(req.params.id, req.body);
        res.status(200).json({ success: true, message: "Attribute updated successfully." });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};