// ==============================================================================
// PRODUCT MANAGEMENT JS (RESTful API) - ADD PRODUCT
// Integrates Complex Multi-Upload, Cropping, and Dynamic Attributes
// ==============================================================================

// --- GLOBAL STATE QUEUES ---
let queuedVariantsArray = [];
let croppedImagesArray = [];
let variantCounter = 0;
let editingVariantIndex = -1; // -1 means we are creating a NEW variant
let cropperInstance = null;

// --- DOM ELEMENTS ---
const mainForm = document.getElementById('addProductMainForm');
const categorySelect = document.getElementById('productCategory');
const queuedVariantsList = document.getElementById('queuedVariantsList');
const emptyVariantsMsg = document.getElementById('emptyVariantsMsg');

const modal = document.getElementById('addVariantModal');
const backdrop = document.getElementById('variantModalBackdrop');
const panel = document.getElementById('variantModalPanel');
const tempVariantForm = document.getElementById('tempVariantForm');
const dynamicAttributesGrid = document.getElementById('dynamicAttributesGrid');

const multiImageInput = document.getElementById('multiImageInput');
const addImageBtn = document.getElementById('addImageBtn');
const croppedPreviews = document.getElementById('croppedPreviews');

const cropperModal = document.getElementById('cropperModal');
const imageToCrop = document.getElementById('imageToCrop');

const productTypeContainer = document.getElementById('dynamicProductTypeContainer');

// ==========================================
// 1. FETCH & RENDER DYNAMIC ATTRIBUTES (Main Page vs Modal)
// ==========================================

// Listen for category changes on the main page
categorySelect.addEventListener('change', async function() {
    await fetchAndRenderAttributes(this.value);
});

// Fetch the data
async function fetchAndRenderAttributes(categoryId) {
    if (!categoryId) {
        productTypeContainer.innerHTML = '';
        return;
    }

    try {
        const response = await fetch(`/admin/category/${categoryId}/attributes`);
        const data = await response.json();

        if (data.success) {
            // MAGIC: Separate the "Product Type" attribute from the "Variant" attributes
            const productTypeAttr = data.attributes.find(attr => 
                attr.displayLabel.toLowerCase().includes('product type') || 
                attr.internalName.toLowerCase().includes('product type')
            );
            
            // ✅ CRITICAL FIX: Save the remaining attributes globally so the Modal ONLY sees these!
            window.currentVariantAttributes = data.attributes.filter(attr => 
                attr._id !== (productTypeAttr ? productTypeAttr._id : null)
            );

            // Render the Product Type dropdown on the main page
            if (productTypeAttr) {
                renderProductTypeDropdown(productTypeAttr);
            } else {
                productTypeContainer.innerHTML = ''; // Clear if this category has no "Type" attribute
            }
        }
    } catch (error) {
        console.error("Error fetching attributes:", error);
    }
}

// Build the HTML dropdown dynamically
function renderProductTypeDropdown(attribute) {
    let optionsHtml = `<option value="">Select ${attribute.displayLabel}</option>`;
    
    attribute.possibleValues.forEach(val => {
        optionsHtml += `<option value="${val}">${val}</option>`;
    });

    // Inject into the page
    productTypeContainer.innerHTML = `
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            ${attribute.displayLabel} *
        </label>
        <select name="productType" required class="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg focus:ring-primary focus:border-primary block p-2.5 dark:bg-slate-800 dark:border-slate-600 dark:text-white transition-colors">
            ${optionsHtml}
        </select>
    `;
}

// ==========================================
// 2. MODAL ANIMATION & OPEN FLOW 
// ==========================================
document.getElementById('openVariantModalBtn').addEventListener('click', async function () {
    const categoryId = categorySelect.value;
    const nameVal = document.getElementById('productName').value.trim();
    const brandVal = document.getElementById('productBrand').value.trim();

    if (!nameVal || !brandVal || !categoryId) {
        Swal.fire({
            icon: 'warning',
            title: 'Hold on!',
            text: 'Please enter the Product Name, Brand, and select a Category before adding variants.',
            confirmButtonColor: '#e83e8c'
        });
        return;
    }

    // Use the globally saved attributes that EXCLUDE the Product Type!
    if (!window.currentVariantAttributes) {
        this.innerHTML = '<span class="material-icons-outlined animate-spin mr-1">progress_activity</span> Loading...';
        this.disabled = true;
        await fetchAndRenderAttributes(categoryId);
        this.innerHTML = '<span class="material-icons-outlined text-sm">add</span> Add New Variant';
        this.disabled = false;
    }

    renderDynamicAttributes(window.currentVariantAttributes);
    openVariantModal();
});

// Build HTML inputs for the MODAL based on Attribute datatypes
function renderDynamicAttributes(attributes) {
    dynamicAttributesGrid.innerHTML = '';

    if (!attributes || attributes.length === 0) {
        dynamicAttributesGrid.innerHTML = '<p class="text-sm text-slate-500 col-span-2">No dynamic attributes linked to this category.</p>';
        return;
    }

    attributes.forEach(attr => {
        let inputHtml = '';

        if (attr.dataType === 'array') {
            // RENDERS CHECKBOXES FOR MULTIPLE SELECTIONS
            let checkboxes = attr.possibleValues.map(val => `
                <label class="inline-flex items-center mr-4 mb-2 cursor-pointer group">
                    <input type="checkbox" name="attr_${attr._id}" value="${val}" class="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 transition-colors">
                    <span class="ml-2 text-sm text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">${val}</span>
                </label>
            `).join('');

            // Appends explicit "N/A" checkbox at the end
            checkboxes += `
                <label class="inline-flex items-center mr-4 mb-2 cursor-pointer group">
                    <input type="checkbox" name="attr_${attr._id}" value="N/A" class="w-4 h-4 text-slate-400 bg-white border-slate-300 rounded focus:ring-slate-500 transition-colors">
                    <span class="ml-2 text-sm italic text-slate-500 group-hover:text-slate-700 transition-colors">N/A</span>
                </label>
            `;

            inputHtml = `
                <div class="checkbox-group p-3 bg-slate-50 border border-slate-300 rounded-lg dark:bg-slate-800 dark:border-slate-600">
                    <div class="flex flex-wrap">${checkboxes}</div>
                </div>`;

        } else if (attr.dataType === 'enum') {
            // RENDERS DROPDOWN FOR SINGLE SELECTION
            const options = attr.possibleValues.map(val => `<option value="${val}">${val}</option>`).join('');
            const naOption = `<option value="N/A" class="italic text-slate-500">N/A (Not Applicable)</option>`;
            inputHtml = `
                <select name="attr_${attr._id}" class="w-full bg-white border border-slate-300 text-slate-900 rounded-lg focus:ring-primary p-2.5 dark:bg-slate-800 dark:border-slate-600 dark:text-white transition-colors">
                    <option value="" disabled selected>Select ${attr.displayLabel || attr.name}</option>
                    ${options}${naOption} 
                </select>
            `;
        } else {
            // RENDERS STANDARD TEXT/NUMBER INPUTS
            const isNumber = attr.dataType === 'number';
            const placeholderText = isNumber ? `Enter ${attr.displayLabel || attr.name} (Type 0 if N/A)` : `Enter ${attr.displayLabel || attr.name} (Type N/A)`;
            inputHtml = `
                <input type="${isNumber ? 'number' : 'text'}" name="attr_${attr._id}" placeholder="${placeholderText}" 
                    class="w-full bg-white border border-slate-300 text-slate-900 rounded-lg focus:ring-primary p-2.5 dark:bg-slate-800 dark:border-slate-600 dark:text-white transition-colors text-sm">
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
    editingVariantIndex = -1; // Reset to 'Add' mode
    modal.classList.remove('hidden');
    croppedImagesArray = [];
    renderImagePreviews();
    generateSmartSKU();

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
        editingVariantIndex = -1; // Clear tracker
    }, 300);
}

document.querySelectorAll('.closeVariantModal').forEach(el => {
    el.addEventListener('click', closeVariantModal);
});


// ==========================================
// 3. MULTI-IMAGE CROPPER FLOW
// ==========================================
addImageBtn.addEventListener('click', () => multiImageInput.click());

multiImageInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        Swal.fire('Error', 'Please upload a valid image file (JPG, PNG, WEBP).', 'error');
        this.value = '';
        return;
    }
    openCropper(file);
});

function openCropper(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        imageToCrop.src = event.target.result;
        cropperModal.classList.remove('hidden');

        cropperInstance = new Cropper(imageToCrop, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 1,
            background: false
        });
    };
    reader.readAsDataURL(file);
}

document.getElementById('cancelCropBtn').addEventListener('click', closeCropper);

function closeCropper() {
    cropperModal.classList.add('hidden');
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
    multiImageInput.value = '';
}

document.getElementById('confirmCropBtn').addEventListener('click', function () {
    if (!cropperInstance) return;

    cropperInstance.getCroppedCanvas({
        width: 1000, height: 1000
    }).toBlob((blob) => {
        const fileName = `variant_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        croppedImagesArray.push(file);
        renderImagePreviews();
        closeCropper();
    }, 'image/jpeg', 0.9);
});

function renderImagePreviews() {
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
        addImageBtn.insertAdjacentHTML('beforebegin', previewHtml);
    });
}

window.removeTempImage = function (index) {
    croppedImagesArray.splice(index, 1);
    renderImagePreviews();
}

// ==========================================
// 4. QUEUE VARIANT (Save to JS Array) - WITH VALIDATION
// ==========================================
document.getElementById('saveVariantToQueueBtn').addEventListener('click', function () {
    document.querySelectorAll('.error-border').forEach(el => el.classList.remove('border-red-500', 'error-border'));
    let isValid = true;
    let errorMessage = '';

    const skuInput = tempVariantForm.querySelector('[name="sku"]');
    const priceInput = tempVariantForm.querySelector('[name="price"]');
    const stockInput = tempVariantForm.querySelector('[name="stock"]');

    const skuVal = skuInput.value.trim();
    if (!skuVal || !/^[A-Za-z0-9-_]+$/.test(skuVal)) {
        skuInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• SKU must be alphanumeric without spaces (dashes/underscores allowed).<br>';
        isValid = false;
    }

    const priceVal = parseFloat(priceInput.value);
    if (isNaN(priceVal) || priceVal <= 0) {
        priceInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• Price must be a valid number greater than ₹0.<br>';
        isValid = false;
    }

    const stockVal = parseInt(stockInput.value);
    if (isNaN(stockVal) || stockVal < 0) {
        stockInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• Stock quantity cannot be negative.<br>';
        isValid = false;
    }

    // --- VALIDATE & CAPTURE DYNAMIC ATTRIBUTES ---
    const attributesMap = [];
    let hasAttrError = false;

    // Grab all unique attribute names on the screen
    const dynamicInputs = tempVariantForm.querySelectorAll('[name^="attr_"]');
    const uniqueAttrNames = [...new Set(Array.from(dynamicInputs).map(i => i.name))];

    uniqueAttrNames.forEach(name => {
        const attributeId = name.substring(5);
        const inputs = tempVariantForm.querySelectorAll(`[name="${name}"]`);

        if (inputs[0].type === 'checkbox') {
            // ARRAY LOGIC: Handle multiple checkboxes
            const checkedValues = Array.from(inputs).filter(i => i.checked).map(i => i.value);

            if (checkedValues.length === 0) {
                // If nothing is checked, highlight the box red
                inputs[0].closest('.checkbox-group').classList.add('border-red-500', 'bg-red-50');
                isValid = false;
                hasAttrError = true;
            } else {
                // Remove error styling if fixed, and join the values (e.g. "Red, Blue")
                inputs[0].closest('.checkbox-group').classList.remove('border-red-500', 'bg-red-50');
                attributesMap.push({ attributeId, value: checkedValues.join(', ') });
            }

        } else {
            // ENUM/STRING/NUMBER LOGIC: Handle standard inputs
            const val = inputs[0].value.trim();
            const alnumCount = val.replace(/[^a-zA-Z0-9]/g, '').length;

            if (!val || (inputs[0].type === 'text' && alnumCount === 0 && val.toUpperCase() !== 'N/A')) {
                inputs[0].classList.add('border-red-500', 'error-border');
                isValid = false;
                hasAttrError = true;
            } else {
                attributesMap.push({ attributeId, value: val });
            }
        }
    });

    // Prevents duplicate error messages on the screen
    if (hasAttrError) {
        errorMessage += '• All attributes must contain valid text, be marked as N/A, or have at least one checkbox selected.<br>';
    }

    if (croppedImagesArray.length < 3) {
        errorMessage += `• Minimum 3 images required. You currently have ${croppedImagesArray.length}.<br>`;
        isValid = false;
    }

    if (!isValid) {
        return Swal.fire({
            icon: 'error',
            title: 'Please fix the following errors:',
            html: `<div class="text-left text-sm text-slate-600 mt-2">${errorMessage}</div>`,
            confirmButtonColor: '#e83e8c'
        });
    }

    // --- BUILD FINAL DATA & SAVE ---
    const formData = new FormData(tempVariantForm);
    const variantData = { attributes: attributesMap, imageFiles: [...croppedImagesArray] };

    // Grab the base text fields (sku, price, stock)
    for (let [key, value] of formData.entries()) {
        if (!key.startsWith('attr_')) {
            variantData[key] = value;
        }
    }

    // Update existing or add new
    if (editingVariantIndex >= 0) {
        if (queuedVariantsArray[editingVariantIndex]._id) {
            variantData._id = queuedVariantsArray[editingVariantIndex]._id;
        }
        queuedVariantsArray[editingVariantIndex] = variantData;
    } else {
        queuedVariantsArray.push(variantData);
    }

    renderVariantQueueUI();
    closeVariantModal();
});

// ==========================================
// RENDER UI (Responsive Layout)
// ==========================================
function renderVariantQueueUI() {
    queuedVariantsList.innerHTML = '';

    if (queuedVariantsArray.length === 0) {
        queuedVariantsList.appendChild(emptyVariantsMsg);
        emptyVariantsMsg.classList.remove('hidden');
        return;
    }

    emptyVariantsMsg.classList.add('hidden');

    queuedVariantsArray.forEach((variant, index) => {
        let firstImgUrl = '/images/placeholder.jpg';
        if (variant.imageFiles && variant.imageFiles.length > 0) {
            firstImgUrl = URL.createObjectURL(variant.imageFiles[0]);
        } else if (variant.images && variant.images.length > 0) {
            firstImgUrl = variant.images[0];
        }

        const stockNum = parseInt(variant.stock) || 0;
        let stockText = '';
        let stockClasses = '';

        if (stockNum === 0) {
            stockText = 'Out of Stock';
            stockClasses = 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
        } else if (stockNum <= 10) {
            stockText = 'Low Stock';
            stockClasses = 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30';
        } else {
            stockText = 'In Stock';
            stockClasses = 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30';
        }

        // Stacked Details to prevent squishing
        const cardHtml = `
            <div class="variant-queue-card flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all group">
                
                <img src="${firstImgUrl}" class="w-14 h-14 rounded-lg object-cover border border-slate-100 dark:border-slate-700 flex-shrink-0">
                
                <div class="flex flex-col flex-grow min-w-0">
                    <div class="font-bold text-slate-800 dark:text-white text-sm truncate uppercase" title="${variant.sku}">
                        ${variant.sku}
                    </div>
                    
                    <div class="text-slate-600 dark:text-slate-400 font-medium text-sm mt-0.5 mb-1.5">
                        ₹${parseFloat(variant.price).toFixed(2)}
                    </div>
                    
                    <div class="${stockClasses} font-semibold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider w-max">
                        ${stockNum} - ${stockText}
                    </div>
                </div>
                
                <div class="flex flex-col gap-2 flex-shrink-0">
                    <button type="button" onclick="editVariantInQueue(${index})" class="text-blue-600 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-md transition-colors flex items-center justify-center" title="Edit Variant">
                        <span class="material-icons-outlined text-[16px]">edit</span>
                    </button>
                    <button type="button" onclick="removeVariantFromQueue(${index})" class="text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-md transition-colors flex items-center justify-center" title="Delete Variant">
                        <span class="material-icons-outlined text-[16px]">delete</span>
                    </button>
                </div>
            </div>
        `;
        queuedVariantsList.insertAdjacentHTML('beforeend', cardHtml);
    });
}

window.removeVariantFromQueue = function (index) {
    queuedVariantsArray.splice(index, 1);
    renderVariantQueueUI();
}

window.editVariantInQueue = async function (index) {
    editingVariantIndex = index;
    const variant = queuedVariantsArray[index];
    const categoryId = categorySelect.value;

    if (!window.currentVariantAttributes) {
        await fetchAndRenderAttributes(categoryId);
    }
    renderDynamicAttributes(window.currentVariantAttributes);

    tempVariantForm.querySelector('[name="sku"]').value = variant.sku;
    tempVariantForm.querySelector('[name="price"]').value = variant.price;
    tempVariantForm.querySelector('[name="stock"]').value = variant.stock;

    // CRITICAL FIX: Pre-fill Dynamic Attributes (Smart enough to handle Checkboxes!)
    if (variant.attributes) {
        variant.attributes.forEach(attr => {
            const inputs = tempVariantForm.querySelectorAll(`[name="attr_${attr.attributeId}"]`);
            if (inputs.length > 0) {
                if (inputs[0].type === 'checkbox') {
                    // It's a checkbox array! Split the saved string (e.g. "Red, Blue") and check them
                    const savedValues = attr.value.split(',').map(v => v.trim());
                    inputs.forEach(chk => {
                        if (savedValues.includes(chk.value)) {
                            chk.checked = true;
                        }
                    });
                } else {
                    // It's a standard dropdown or text input
                    inputs[0].value = attr.value;
                }
            }
        });
    }

    croppedImagesArray = [...(variant.imageFiles || [])];

    renderImagePreviews();

    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        panel.classList.replace('scale-95', 'scale-100');
        panel.classList.replace('opacity-0', 'opacity-100');
    }, 10);
};

// ==========================================
// 5. FINAL SUBMIT (Standard POST Multipart)
// ==========================================
mainForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    document.querySelectorAll('.error-border').forEach(el => el.classList.remove('border-red-500', 'error-border'));
    let isValid = true;
    let errorMessage = '';

    const nameInput = document.getElementById('productName');
    const brandInput = document.getElementById('productBrand');
    const categoryInput = document.getElementById('productCategory');
    const descInput = document.getElementById('productDescription');
    const productTypeSelect = document.querySelector('select[name="productType"]');

    const nameVal = nameInput.value.trim();
    const brandVal = brandInput.value.trim();
    const descVal = descInput.value.trim();

    if (nameVal.replace(/[^a-zA-Z0-9]/g, '').length < 3) {
        nameInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• Product Name must contain at least 3 valid letters or numbers.<br>';
        isValid = false;
    }

    if (brandVal.replace(/[^a-zA-Z0-9]/g, '').length < 2) {
        brandInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• Brand Name must contain at least 2 valid letters or numbers.<br>';
        isValid = false;
    }

    if (!categoryInput.value) {
        categoryInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• Please select a Category.<br>';
        isValid = false;
    }

    if (descVal.length > 0 && descVal.replace(/[^a-zA-Z0-9]/g, '').length < 10) {
        descInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• If provided, the Description must contain at least 10 valid letters or numbers.<br>';
        isValid = false;
    }

    // ✅ NEW: Final Form Validation for Product Type
    if (productTypeSelect && !productTypeSelect.value) { 
        productTypeSelect.classList.add('border-red-500', 'error-border'); 
        errorMessage += '• Select a Product Type.<br>'; 
        isValid = false; 
    }

    if (queuedVariantsArray.length === 0) {
        errorMessage += '• You must add at least one Variant (Size/Color) before saving.<br>';
        isValid = false;
    }

    if (!isValid) {
        Swal.fire({
            icon: 'error',
            title: 'Unable to Save Product',
            html: `<div class="text-left text-sm text-slate-600 mt-2">${errorMessage}</div>`,
            confirmButtonColor: '#e83e8c'
        });
        return;
    }

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

    const brandVal = document.getElementById('productBrand').value.trim();
    const nameVal = document.getElementById('productName').value.trim();

    const brandCode = brandVal.length >= 3 ? brandVal.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '') : 'XXX';
    const nameCode = nameVal.length >= 4 ? nameVal.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') : 'XXXX';
    const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();

    skuInput.value = `${brandCode}-${nameCode}-${randomChars}`;
}