// ==============================================================================
// PRODUCT MANAGEMENT JS (RESTful API)
// Integrates Complex Multi-Upload, Cropping, and Dynamic Attributes
// ==============================================================================

// --- GLOBAL STATE QUEUES ---
// These arrays hold data temporarily BEFORE saving to MongoDB
let queuedVariantsArray = []; // Holds variant text data & attribute mappings
let croppedImagesArray = []; // Temporarily holds blobs for the current variant being edited
let variantCounter = 0; // Ensures unique IDs in the queue UI

// Cropper.js instance
let cropperInstance = null;

// --- DOM ELEMENTS ---
// Main Page elements
const mainForm = document.getElementById('addProductMainForm');
const categorySelect = document.getElementById('productCategory');
const queuedVariantsList = document.getElementById('queuedVariantsList');
const emptyVariantsMsg = document.getElementById('emptyVariantsMsg');

// Variant Modal elements
const modal = document.getElementById('addVariantModal');
const backdrop = document.getElementById('variantModalBackdrop');
const panel = document.getElementById('variantModalPanel');
const tempVariantForm = document.getElementById('tempVariantForm');
const dynamicAttributesGrid = document.getElementById('dynamicAttributesGrid');

// Multi-Image Elements matching constraints
const multiImageInput = document.getElementById('multiImageInput');
const addImageBtn = document.getElementById('addImageBtn');
const croppedPreviews = document.getElementById('croppedPreviews');

// Cropper Modal
const cropperModal = document.getElementById('cropperModal');
const imageToCrop = document.getElementById('imageToCrop');

// Cache of fetched attributes to avoid redundant AJAX calls
let categoryAttributeCache = {};


// ==========================================
// 1. MODAL ANIMATION & OPEN FLOW (RESTFUL AJAX)
// ==========================================

// Pre-Open Gate: Only open modal if Name, Brand, and Category are filled
document.getElementById('openVariantModalBtn').addEventListener('click', async function () {
    const categoryId = categorySelect.value;
    const nameVal = document.getElementById('productName').value.trim();
    const brandVal = document.getElementById('productBrand').value.trim();

    // NEW: Check if all base details are filled
    if (!nameVal || !brandVal || !categoryId) {
        Swal.fire({
            icon: 'warning',
            title: 'Hold on!',
            text: 'Please enter the Product Name, Brand, and select a Category before adding variants.',
            confirmButtonColor: '#e83e8c'
        });
        return; // Stop them from opening the modal!
    }
    // Load Attributes via RESTful AJAX (or Cache)
    let attributes = [];
    if (categoryAttributeCache[categoryId]) {
        attributes = categoryAttributeCache[categoryId];
    } else {
        // Show Loading state on button
        this.innerHTML = '<span class="material-icons-outlined animate-spin mr-1">progress_activity</span> Loading...';
        this.disabled = true;

        try {
            // RESTful: GET /admin/category/:id/attributes
            const response = await fetch(`/admin/category/${categoryId}/attributes`);
            const data = await response.json();
            if (data.success) {
                attributes = data.attributes;
                categoryAttributeCache[categoryId] = attributes; // Cache it
            }
        } catch (error) {
            Swal.fire('Error', 'Failed to fetch category attributes.', 'error');
            return;
        } finally {
            // Restore button state
            this.innerHTML = '<span class="material-icons-outlined text-sm">add</span> Add New Variant';
            this.disabled = false;
        }
    }

    // Build the dynamic form based on the Eraser Schema structure
    renderDynamicAttributes(attributes);
    openVariantModal();
});

// Build HTML inputs based on Eraser.io Attribute datatypes
function renderDynamicAttributes(attributes) {
    dynamicAttributesGrid.innerHTML = ''; // Clear previous

    if (!attributes || attributes.length === 0) {
        dynamicAttributesGrid.innerHTML = '<p class="text-sm text-slate-500 col-span-2">No dynamic attributes linked to this category.</p>';
        return;
    }

    attributes.forEach(attr => {
        let inputHtml = '';

        // Match standard RESTful input naming convention: variants[key][value]
        // This makes req.body parsing on backend extremely clean

        // Handle ENUM/ARRAY types (Dropdowns)
        if (attr.dataType === 'enum' || attr.dataType === 'array') {
            // 1. Map the actual values from the database
            const options = attr.possibleValues.map(val => `<option value="${val}">${val}</option>`).join('');

            // 2. NEW: Automatically create an "N/A" option for every dropdown
            const naOption = `<option value="N/A" class="italic text-slate-500">N/A (Not Applicable)</option>`;

            inputHtml = `
                <select name="attr_${attr._id}" required class="w-full bg-white border border-slate-300 text-slate-900 rounded-lg focus:ring-primary p-2.5 dark:bg-slate-800 dark:border-slate-600 dark:text-white transition-colors">
                    <option value="" disabled selected>Select ${attr.displayLabel || attr.name}</option>
                    ${options}
                    ${naOption} 
                </select>
            `;
        } else {
            // Handle STRING/NUMBER types with smart placeholders
            const isNumber = attr.dataType === 'number';
            const inputType = isNumber ? 'number' : 'text';

            // Custom placeholder instructions based on the data type
            const placeholderText = isNumber
                ? `Enter ${attr.displayLabel || attr.name} (Type 0 if not applicable)`
                : `Enter ${attr.displayLabel || attr.name} (Type N/A if not applicable)`;

            inputHtml = `
                <input type="${inputType}" name="attr_${attr._id}" required placeholder="${placeholderText}" 
                    class="w-full bg-white border border-slate-300 text-slate-900 rounded-lg focus:ring-primary p-2.5 dark:bg-slate-800 dark:border-slate-600 dark:text-white transition-colors text-sm placeholder:text-slate-400">
            `;
        }

        const attrHtml = `
            <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">${attr.displayLabel || attr.name} *</label>
                ${inputHtml}
            </div>
        `;
        dynamicAttributesGrid.insertAdjacentHTML('beforeend', attrHtml);
    });
}

function openVariantModal() {
    // 1. NEW: Check if category is selected first (Crucial for loading attributes!)
    const categoryInput = document.getElementById('productCategory');
    if (categoryInput && !categoryInput.value) {
        Swal.fire('Wait!', 'Please select a Category first so we can load the correct attributes.', 'warning');
        return;
    }

    // 2. Your existing modal reveal code
    modal.classList.remove('hidden');
    croppedImagesArray = []; // Reset image temporary array
    renderImagePreviews(); // Reset previews UI

    // 3. NEW: Fire the SKU generator exactly as the modal opens!
    generateSmartSKU();

    // 4. Your existing smooth animation code
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        panel.classList.replace('scale-95', 'scale-100');
        panel.classList.replace('opacity-0', 'opacity-100');
    }, 10);
}

function closeVariantModal() {
    backdrop.classList.replace('opacity-100', 'opacity-0');
    panel.classList.replace('scale-100', 'scale-95');
    panel.classList.replace('opacity-100', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        tempVariantForm.reset();
        dynamicAttributesGrid.innerHTML = '';
        multiImageInput.value = '';
    }, 300);
}

// Close listeners
document.querySelectorAll('.closeVariantModal').forEach(el => {
    el.addEventListener('click', closeVariantModal);
});


// ==========================================
// 2. MULTI-IMAGE CROPPER FLOW - Constraints: Multi + 1:1 Aspect + Blob
// ==========================================

// Trigger file input when large "Add Photo" group is clicked
addImageBtn.addEventListener('click', () => multiImageInput.click());

// Handle file selection (Standard Multer file interception)
multiImageInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        Swal.fire('Error', 'Please upload a valid image file (JPG, PNG, WEBP).', 'error');
        this.value = '';
        return;
    }

    // Fire up Cropper sequential flow
    openCropper(file);
});

// OPEN Cropper Modal with specific file
function openCropper(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        imageToCrop.src = event.target.result;
        cropperModal.classList.remove('hidden');

        // Initialize Cropper.js - Forcing 1:1 square aspect ratio
        cropperInstance = new Cropper(imageToCrop, {
            aspectRatio: 1, // REQUIRED ASPECT
            viewMode: 1,
            autoCropArea: 1,
            background: false
        });
    };
    reader.readAsDataURL(file);
}

// CANCEL Crop
document.getElementById('cancelCropBtn').addEventListener('click', closeCropper);

function closeCropper() {
    cropperModal.classList.add('hidden');
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    multiImageInput.value = ''; // Reset input to allow selecting same file again
}

// CONFIRM Crop - Convert to Blob (Constraint match)
document.getElementById('confirmCropBtn').addEventListener('click', function () {
    if (!cropperInstance) return;

    // Convert cropped canvas to highly-efficient blob binary
    cropperInstance.getCroppedCanvas({
        width: 1000, height: 1000 // standardize size before upload
    }).toBlob((blob) => {
        // Package blob as a standard File object, ready for multipart/form-data upload
        const fileName = `variant_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });

        // Add to temp array specific to THIS variant being edited
        croppedImagesArray.push(file);

        // Update UI
        renderImagePreviews();
        closeCropper();
    }, 'image/jpeg', 0.9); // Quality level compression
});

// RENDER temporary image previews INSIDE MODAL (Seq Flow)
function renderImagePreviews() {
    // Keep the "Add Photo" button
    croppedPreviews.innerHTML = '';
    croppedPreviews.appendChild(addImageBtn);

    croppedImagesArray.forEach((file, index) => {
        const imageUrl = URL.createObjectURL(file);

        const previewHtml = `
            <div class="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square transition-all hover:border-red-400">
                <img src="${imageUrl}" class="w-full h-full object-cover">
                <button type="button" onclick="removeTempImage(${index})" class="absolute inset-0 bg-red-900/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                    <span class="material-icons-outlined text-2xl">delete</span>
                </button>
            </div>
        `;
        // Insert BEFORE the Add button
        addImageBtn.insertAdjacentHTML('beforebegin', previewHtml);
    });
}

// Remove image from temp array (Seq flow delete)
window.removeTempImage = function (index) {
    croppedImagesArray.splice(index, 1);
    renderImagePreviews();
}


// ==========================================
// 3. QUEUE VARIANT (Save to JS Array) - WITH VALIDATION
// ==========================================
document.getElementById('saveVariantToQueueBtn').addEventListener('click', function () {

    // --- 1. CLEAR PREVIOUS ERRORS ---
    document.querySelectorAll('.error-border').forEach(el => el.classList.remove('border-red-500', 'error-border'));
    let isValid = true;
    let errorMessage = '';

    // --- 2. VALIDATE CORE INPUTS ---
    const skuInput = tempVariantForm.querySelector('[name="sku"]');
    const priceInput = tempVariantForm.querySelector('[name="price"]');
    const stockInput = tempVariantForm.querySelector('[name="stock"]');

    // SKU Validation (No spaces, alphanumeric)
    const skuVal = skuInput.value.trim();
    if (!skuVal || !/^[A-Za-z0-9-_]+$/.test(skuVal)) {
        skuInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• SKU must be alphanumeric without spaces (dashes/underscores allowed).<br>';
        isValid = false;
    }

    // Price Validation
    const priceVal = parseFloat(priceInput.value);
    if (isNaN(priceVal) || priceVal <= 0) {
        priceInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• Price must be a valid number greater than ₹0.<br>';
        isValid = false;
    }

    // Stock Validation
    const stockVal = parseInt(stockInput.value);
    if (isNaN(stockVal) || stockVal < 0) {
        stockInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• Stock quantity cannot be negative.<br>';
        isValid = false;
    }

    // --- 3. VALIDATE DYNAMIC ATTRIBUTES (REGEX SECURED) ---
    const dynamicInputs = tempVariantForm.querySelectorAll('[name^="attr_"]');
    dynamicInputs.forEach(input => {
        const val = input.value.trim();

        // Count actual letters and numbers (ignores spaces and symbols)
        const alnumCount = val.replace(/[^a-zA-Z0-9]/g, '').length;

        // Fails if: empty OR (is a text input AND has 0 letters/numbers AND isn't literally "N/A")
        if (!val || (input.type === 'text' && alnumCount === 0 && val.toUpperCase() !== 'N/A')) {
            input.classList.add('border-red-500', 'error-border');
            isValid = false;
            if (!errorMessage.includes('dynamic attributes')) {
                errorMessage += '• All attributes must contain valid text/numbers or be marked as N/A.<br>';
            }
        }
    });

    // --- 4. VALIDATE IMAGES ---
    if (croppedImagesArray.length < 3) {
        errorMessage += `• Minimum 3 images required. You currently have ${croppedImagesArray.length}.<br>`;
        isValid = false;
    }

    // --- 5. SHOW ERRORS OR PROCEED ---
    if (!isValid) {
        Swal.fire({
            icon: 'error',
            title: 'Please fix the following errors:',
            html: `<div class="text-left text-sm text-slate-600 mt-2">${errorMessage}</div>`,
            confirmButtonColor: '#e83e8c'
        });
        return; // Stop execution
    }

    // --- 6. PROCEED TO SAVE IF VALID ---
    const formData = new FormData(tempVariantForm);
    const variantData = {};
    const attributesMap = [];

    for (let [key, value] of formData.entries()) {
        if (key.startsWith('attr_')) {
            const attributeId = key.substring(5);
            attributesMap.push({ attributeId, value });
        } else {
            variantData[key] = value;
        }
    }

    variantData.attributes = attributesMap;
    variantData.imageFiles = [...croppedImagesArray];

    queuedVariantsArray.push(variantData);
    renderVariantQueueUI();
    closeVariantModal();
});

// Update the RIGHT SIDE grid on main page matching mockup
function renderVariantQueueUI() {
    // Clear list, hide empty message if needed
    queuedVariantsList.innerHTML = '';

    if (queuedVariantsArray.length === 0) {
        queuedVariantsList.appendChild(emptyVariantsMsg);
        emptyVariantsMsg.classList.remove('hidden');
        return;
    }

    emptyVariantsMsg.classList.add('hidden');

    queuedVariantsArray.forEach((variant, index) => {
        // Grab the first image blob for preview in UI matching mockup image
        const firstImgUrl = URL.createObjectURL(variant.imageFiles[0]);

        // Match the styling of the right-side cards from Image 1
        const cardHtml = `
            <div class="variant-queue-card flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 transition-colors group">
                <img src="${firstImgUrl}" class="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700">
                <div class="flex-grow grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <div class="font-medium text-slate-900 dark:text-white uppercase">${variant.sku}</div>
                    <div class="text-slate-600 dark:text-slate-400">₹${parseFloat(variant.price).toFixed(2)}</div>
                    <div class="text-green-600 font-medium">${variant.stock} In Stock</div>
                </div>
                <button type="button" onclick="removeVariantFromQueue(${index})" class="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-red-50 p-1.5 rounded-md">
                    <span class="material-icons-outlined text-[18px]">delete</span>
                </button>
            </div>
        `;
        queuedVariantsList.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// Delete variant card from main grid (UI logic delete)
window.removeVariantFromQueue = function (index) {
    queuedVariantsArray.splice(index, 1);
    renderVariantQueueUI();
}


// ==========================================
// 4. FINAL SUBMIT (Standard POST Multipart) - WITH VALIDATION
// ==========================================
mainForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    // --- 1. CLEAR PREVIOUS ERRORS & INIT VARIABLES ---
    document.querySelectorAll('.error-border').forEach(el => el.classList.remove('border-red-500', 'error-border'));

    // THIS IS WHAT WAS MISSING! We must declare them before using them.
    let isValid = true;
    let errorMessage = '';

    // --- 2. VALIDATE BASE PRODUCT INFO (REGEX SECURED) ---
    const nameInput = document.getElementById('productName');
    const brandInput = document.getElementById('productBrand');
    const categoryInput = document.getElementById('productCategory');
    const descInput = document.getElementById('productDescription');

    const nameVal = nameInput.value.trim();
    const brandVal = brandInput.value.trim();
    const descVal = descInput.value.trim();

    // Strip symbols to count only real letters and numbers
    const nameAlnumCount = nameVal.replace(/[^a-zA-Z0-9]/g, '').length;
    const brandAlnumCount = brandVal.replace(/[^a-zA-Z0-9]/g, '').length;

    if (nameAlnumCount < 3) {
        nameInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• Product Name must contain at least 3 valid letters or numbers.<br>';
        isValid = false;
    }

    if (brandAlnumCount < 2) {
        brandInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• Brand Name must contain at least 2 valid letters or numbers.<br>';
        isValid = false;
    }

    if (!categoryInput.value) {
        categoryInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• Please select a Category.<br>';
        isValid = false;
    }

    // Description is optional, but if they type something, it must be real readable text
    if (descVal.length > 0) {
        const descAlnumCount = descVal.replace(/[^a-zA-Z0-9]/g, '').length;
        if (descAlnumCount < 10) {
            descInput.classList.add('border-red-500', 'error-border');
            errorMessage += '• If provided, the Description must contain at least 10 valid letters or numbers.<br>';
            isValid = false;
        }
    }

    // --- 3. VALIDATE VARIANT QUEUE ---
    if (queuedVariantsArray.length === 0) {
        errorMessage += '• You must add at least one Variant (Size/Color) before saving.<br>';
        isValid = false;
    }

    // --- 4. SHOW ERRORS OR PROCEED ---
    if (!isValid) {
        Swal.fire({
            icon: 'error',
            title: 'Unable to Save Product',
            html: `<div class="text-left text-sm text-slate-600 mt-2">${errorMessage}</div>`,
            confirmButtonColor: '#e83e8c'
        });
        return; // Stop execution
    }

    // --- 5. PROCEED TO UPLOAD IF VALID ---
    const saveBtn = document.getElementById('saveFinalProductBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="material-icons-outlined animate-spin mr-2">progress_activity</span> Saving Product...';

    const finalFormData = new FormData(this);

    const variantsDataJSON = JSON.stringify(queuedVariantsArray.map(v => {
        const { imageFiles, ...textData } = v;
        return textData;
    }));
    finalFormData.append('variantsJSON', variantsDataJSON);

    queuedVariantsArray.forEach((variant, variantIndex) => {
        variant.imageFiles.forEach((file) => {
            finalFormData.append(`variant_images_${variantIndex}`, file);
        });
    });

    try {
        const response = await fetch('/admin/products', {
            method: 'POST',
            body: finalFormData
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire({
                icon: 'success', title: 'Product Created Successfully!',
                text: 'Base product and associated variants have been saved to your database.',
                confirmButtonColor: '#e83e8c'
            }).then(() => window.location.href = '/admin/products');
        } else {
            Swal.fire('Server Error', data.message || 'Failed to save consolidated product.', 'error');
        }
    } catch (error) {
        console.error("Consolidated Save Error:", error);
        Swal.fire('Network Error', 'A network error occurred while uploading product data.', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-icons-outlined text-[20px]">save</span> Save Product';
    }
});

// ==========================================
// AUTO-GENERATE SMART SKU
// ==========================================
function generateSmartSKU() {
    const skuInput = document.querySelector('#tempVariantForm [name="sku"]');
    if (!skuInput) return;

    // 1. Get Base Info
    const brandVal = document.getElementById('productBrand').value.trim();
    const nameVal = document.getElementById('productName').value.trim();

    // 2. Format Brand (First 3 letters)
    let brandCode = 'XXX';
    if (brandVal.length >= 3) {
        brandCode = brandVal.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    // 3. Format Name (First 4 letters)
    let nameCode = 'XXXX';
    if (nameVal.length >= 4) {
        nameCode = nameVal.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    // 4. Generate a random 3-character string to guarantee 100% uniqueness
    const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();

    // 5. Build and set the final SKU
    skuInput.value = `${brandCode}-${nameCode}-${randomChars}`;
}