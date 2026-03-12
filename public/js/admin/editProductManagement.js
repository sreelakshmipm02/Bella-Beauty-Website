// ==============================================================================
// EDIT PRODUCT MANAGEMENT JS (RESTful API) - WITH FULL SYNCED UI & CHECKBOXES
// ==============================================================================

// --- 1. GRAB SERVER DATA FROM HIDDEN HTML ELEMENTS ---
const serverProductIdEl = document.getElementById('serverProductId');
const serverCategoryIdEl = document.getElementById('serverCategoryId');
const serverVariantsDataEl = document.getElementById('serverVariantsData');

const PRODUCT_ID = serverProductIdEl ? serverProductIdEl.value : '';
const CATEGORY_ID = serverCategoryIdEl ? serverCategoryIdEl.value : '';

let queuedVariantsArray = [];

// --- GLOBAL STATE QUEUES ---
let croppedImagesArray = [];
let tempOldImages = []; // Old Cloudinary URLs
let editingVariantIndex = -1; // -1 means NEW variant
let cropperInstance = null;
let categoryAttributeCache = {};

// --- INITIALIZE DATA SAFELY ---
document.addEventListener('DOMContentLoaded', () => {
    if (serverVariantsDataEl && serverVariantsDataEl.value) {
        try {
            queuedVariantsArray = JSON.parse(serverVariantsDataEl.value);
        } catch (error) {
            console.error("Failed to parse variants JSON:", error);
        }
    }
    renderVariantQueueUI();
});

// --- DOM ELEMENTS ---
const mainForm = document.getElementById('editProductMainForm');
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

// ==========================================
// 1. MODAL OPEN/CLOSE & ATTRIBUTE LOGIC
// ==========================================

// Click "Add New Variant"
document.getElementById('openVariantModalBtn').addEventListener('click', async function () {
    const nameVal = document.getElementById('productName').value.trim();
    const brandVal = document.getElementById('productBrand').value.trim();

    if (!nameVal || !brandVal) {
        return Swal.fire({ icon: 'warning', title: 'Hold on!', text: 'Please enter the Product Name and Brand before adding variants.', confirmButtonColor: '#e83e8c' });
    }

    // CRITICAL FIX: Reset everything for a brand new variant!
    editingVariantIndex = -1;
    tempOldImages = [];
    croppedImagesArray = [];
    tempVariantForm.reset();

    await loadAndRenderAttributes();
    generateSmartSKU();

    renderImagePreviews();
    openVariantModal();
});

// Click "Edit" on an existing variant
window.editVariantInQueue = async function (index) {
    editingVariantIndex = index;
    const variant = queuedVariantsArray[index];

    await loadAndRenderAttributes();

    tempVariantForm.querySelector('[name="sku"]').value = variant.sku;
    tempVariantForm.querySelector('[name="price"]').value = variant.price;
    tempVariantForm.querySelector('[name="stock"]').value = variant.stock;

    // Pre-fill Dynamic Attributes (Smart enough to handle Checkboxes!)
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

    // Load old images and new blobs
    tempOldImages = [...(variant.images || [])];
    croppedImagesArray = [...(variant.imageFiles || [])];

    renderImagePreviews();
    openVariantModal();
};

async function loadAndRenderAttributes() {
    let attributes = categoryAttributeCache[CATEGORY_ID];
    if (!attributes) {
        try {
            const response = await fetch(`/admin/category/${CATEGORY_ID}/attributes`);
            const data = await response.json();
            if (data.success) {
                attributes = data.attributes;
                categoryAttributeCache[CATEGORY_ID] = attributes;
            }
        } catch (error) {
            Swal.fire('Error', 'Failed to fetch category attributes.', 'error');
            return;
        }
    }
    renderDynamicAttributes(attributes);
}

function renderDynamicAttributes(attributes) {
    dynamicAttributesGrid.innerHTML = '';

    if (!attributes || attributes.length === 0) {
        dynamicAttributesGrid.innerHTML = '<p class="text-sm text-slate-500 col-span-2">No dynamic attributes linked to this category.</p>';
        return;
    }

    attributes.forEach(attr => {
        let inputHtml = '';

        if (attr.dataType === 'array') {
            // Render Checkboxes for MULTIPLE selections
            let checkboxes = attr.possibleValues.map(val => `
                <label class="inline-flex items-center mr-4 mb-2 cursor-pointer group">
                    <input type="checkbox" name="attr_${attr._id}" value="${val}" class="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 transition-colors">
                    <span class="ml-2 text-sm text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">${val}</span>
                </label>
            `).join('');

            // Append explicit "N/A" checkbox at the end
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
            // Dropdown for SINGLE selection
            const options = attr.possibleValues.map(val => `<option value="${val}">${val}</option>`).join('');
            const naOption = `<option value="N/A" class="italic text-slate-500">N/A (Not Applicable)</option>`;
            inputHtml = `
                <select name="attr_${attr._id}" class="w-full bg-white border border-slate-300 text-slate-900 rounded-lg focus:ring-primary p-2.5 dark:bg-slate-800 dark:border-slate-600 dark:text-white transition-colors">
                    <option value="" disabled selected>Select ${attr.displayLabel || attr.name}</option>
                    ${options}${naOption} 
                </select>
            `;
        } else {
            // Standard Text/Number inputs
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

function openVariantModal() {
    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.replace('opacity-0', 'opacity-100');
        panel.classList.replace('scale-95', 'scale-100');
        panel.classList.replace('opacity-0', 'opacity-100');
    }, 10);
}

document.querySelectorAll('.closeVariantModal').forEach(el => el.addEventListener('click', () => {
    backdrop.classList.replace('opacity-100', 'opacity-0');
    panel.classList.replace('scale-100', 'scale-95');
    panel.classList.replace('opacity-100', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        tempVariantForm.reset();
        dynamicAttributesGrid.innerHTML = '';
        multiImageInput.value = '';
        editingVariantIndex = -1; // CRITICAL: Reset state on close
    }, 300);
}));

// ==========================================
// 2. IMAGE CROPPER LOGIC
// ==========================================
addImageBtn.addEventListener('click', () => multiImageInput.click());

multiImageInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        Swal.fire('Error', 'Please upload a valid image (JPG, PNG, WEBP).', 'error');
        this.value = ''; return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
        imageToCrop.src = event.target.result;
        cropperModal.classList.remove('hidden');
        cropperInstance = new Cropper(imageToCrop, { aspectRatio: 1, viewMode: 1, autoCropArea: 1, background: false });
    };
    reader.readAsDataURL(file);
});

document.getElementById('cancelCropBtn').addEventListener('click', () => {
    cropperModal.classList.add('hidden');
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    multiImageInput.value = '';
});

document.getElementById('confirmCropBtn').addEventListener('click', function () {
    if (!cropperInstance) return;
    cropperInstance.getCroppedCanvas({ width: 1000, height: 1000 }).toBlob((blob) => {
        const file = new File([blob], `variant_${Date.now()}.jpg`, { type: 'image/jpeg' });
        croppedImagesArray.push(file);
        renderImagePreviews();
        document.getElementById('cancelCropBtn').click();
    }, 'image/jpeg', 0.9);
});

function renderImagePreviews() {
    croppedPreviews.innerHTML = '';
    croppedPreviews.appendChild(addImageBtn);

    // 1. Old DB Images
    tempOldImages.forEach((url, index) => {
        const previewHtml = `<div class="relative group rounded-lg overflow-hidden border border-blue-300 aspect-square"><img src="${url}" class="w-full h-full object-cover"><button type="button" onclick="removeOldTempImage(${index})" class="absolute inset-0 bg-red-900/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><span class="material-icons-outlined text-2xl">delete</span></button><span class="absolute top-1 left-1 bg-blue-500 text-white text-[10px] px-1.5 rounded">Saved</span></div>`;
        addImageBtn.insertAdjacentHTML('beforebegin', previewHtml);
    });

    // 2. New Blobs
    croppedImagesArray.forEach((file, index) => {
        const previewHtml = `<div class="relative group rounded-lg overflow-hidden border border-green-300 aspect-square"><img src="${URL.createObjectURL(file)}" class="w-full h-full object-cover"><button type="button" onclick="removeTempImage(${index})" class="absolute inset-0 bg-red-900/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><span class="material-icons-outlined text-2xl">delete</span></button><span class="absolute top-1 left-1 bg-green-500 text-white text-[10px] px-1.5 rounded">New</span></div>`;
        addImageBtn.insertAdjacentHTML('beforebegin', previewHtml);
    });
}

window.removeTempImage = function (index) { croppedImagesArray.splice(index, 1); renderImagePreviews(); }
window.removeOldTempImage = function (index) { tempOldImages.splice(index, 1); renderImagePreviews(); }

// ==========================================
// 3. SAVE VARIANT TO QUEUE
// ==========================================
document.getElementById('saveVariantToQueueBtn').addEventListener('click', function () {
    document.querySelectorAll('.error-border').forEach(el => el.classList.remove('border-red-500', 'error-border'));
    let isValid = true; let errorMessage = '';

    const skuInput = tempVariantForm.querySelector('[name="sku"]');
    const priceInput = tempVariantForm.querySelector('[name="price"]');
    const stockInput = tempVariantForm.querySelector('[name="stock"]');

    if (!/^[A-Za-z0-9-_]+$/.test(skuInput.value.trim())) { skuInput.classList.add('border-red-500', 'error-border'); errorMessage += '• Invalid SKU.<br>'; isValid = false; }
    if (isNaN(parseFloat(priceInput.value)) || parseFloat(priceInput.value) <= 0) { priceInput.classList.add('border-red-500', 'error-border'); errorMessage += '• Invalid Price.<br>'; isValid = false; }
    if (isNaN(parseInt(stockInput.value)) || parseInt(stockInput.value) < 0) { stockInput.classList.add('border-red-500', 'error-border'); errorMessage += '• Invalid Stock.<br>'; isValid = false; }

    // --- VALIDATE & CAPTURE DYNAMIC ATTRIBUTES ---
    const attributesMap = [];
    let hasAttrError = false;

    const dynamicInputs = tempVariantForm.querySelectorAll('[name^="attr_"]');
    const uniqueAttrNames = [...new Set(Array.from(dynamicInputs).map(i => i.name))];

    uniqueAttrNames.forEach(name => {
        const attributeId = name.substring(5);
        const inputs = tempVariantForm.querySelectorAll(`[name="${name}"]`);

        if (inputs[0].type === 'checkbox') {
            const checkedValues = Array.from(inputs).filter(i => i.checked).map(i => i.value);
            if (checkedValues.length === 0) {
                inputs[0].closest('.checkbox-group').classList.add('border-red-500', 'bg-red-50');
                isValid = false;
                hasAttrError = true;
            } else {
                inputs[0].closest('.checkbox-group').classList.remove('border-red-500', 'bg-red-50');
                attributesMap.push({ attributeId, value: checkedValues.join(', ') });
            }
        } else {
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

    if (hasAttrError) {
        errorMessage += '• All attributes must contain valid text, be marked as N/A, or have at least one checkbox selected.<br>';
    }

    const totalImages = tempOldImages.length + croppedImagesArray.length;
    if (totalImages < 3) { errorMessage += `• Minimum 3 images required. You have ${totalImages}.<br>`; isValid = false; }

    if (!isValid) return Swal.fire({ icon: 'error', title: 'Fix errors:', html: `<div class="text-left text-sm mt-2">${errorMessage}</div>` });

    const formData = new FormData(tempVariantForm);
    const variantData = { attributes: attributesMap };

    // Grab the base text fields (sku, price, stock)
    for (let [key, value] of formData.entries()) {
        if (!key.startsWith('attr_')) variantData[key] = value;
    }

    variantData.images = [...tempOldImages];
    variantData.imageFiles = [...croppedImagesArray];

    // Preserve MongoDB _id when updating
    if (editingVariantIndex >= 0) {
        if (queuedVariantsArray[editingVariantIndex]._id) {
            variantData._id = queuedVariantsArray[editingVariantIndex]._id;
        }
        queuedVariantsArray[editingVariantIndex] = variantData;
    } else {
        queuedVariantsArray.push(variantData);
    }

    renderVariantQueueUI();
    document.querySelector('.closeVariantModal').click();
});

// ==========================================
// RENDER UI (Responsive, Narrow-Screen Friendly Layout)
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

// ==========================================
// 5. FINAL UPDATE SUBMIT (PUT REQUEST)
// ==========================================
mainForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    document.querySelectorAll('.error-border').forEach(el => el.classList.remove('border-red-500', 'error-border'));
    let isValid = true;
    let errorMessage = '';

    const nameInput = document.getElementById('productName');
    const brandInput = document.getElementById('productBrand');
    const descInput = document.getElementById('productDescription');

    const nameVal = nameInput.value.trim();
    const brandVal = brandInput.value.trim();
    const descVal = descInput ? descInput.value.trim() : '';

    if (nameVal.replace(/[^a-zA-Z0-9]/g, '').length < 3) {
        nameInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• Name needs at least 3 valid chars.<br>';
        isValid = false;
    }

    if (brandVal.replace(/[^a-zA-Z0-9]/g, '').length < 2) {
        brandInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• Brand needs at least 2 valid chars.<br>';
        isValid = false;
    }

    if (descVal.length > 0 && descVal.replace(/[^a-zA-Z0-9]/g, '').length < 10) {
        if (descInput) descInput.classList.add('border-red-500', 'error-border');
        errorMessage += '• If provided, the Description must contain at least 10 valid characters.<br>';
        isValid = false;
    }

    if (queuedVariantsArray.length === 0) {
        errorMessage += '• Need at least one variant.<br>';
        isValid = false;
    }

    if (!isValid) return Swal.fire({ icon: 'error', title: 'Cannot Update', html: `<div class="text-left text-sm mt-2">${errorMessage}</div>` });

    const saveBtn = document.getElementById('updateFinalProductBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="material-icons-outlined animate-spin mr-2">progress_activity</span> Updating...';

    const finalFormData = new FormData(this);

    const variantsDataJSON = JSON.stringify(queuedVariantsArray.map(v => {
        const { imageFiles, ...textData } = v;
        return textData;
    }));
    finalFormData.append('variantsJSON', variantsDataJSON);

    queuedVariantsArray.forEach((variant, variantIndex) => {
        if (variant.imageFiles) {
            variant.imageFiles.forEach((file) => finalFormData.append(`variant_images_${variantIndex}`, file));
        }
    });

    try {
        const response = await fetch(`/admin/products/${PRODUCT_ID}`, {
            method: 'PUT',
            body: finalFormData
        });

        const data = await response.json();

        if (data.success) {
            Swal.fire({ icon: 'success', title: 'Updated!', text: 'Product successfully updated.' }).then(() => window.location.href = '/admin/products');
        } else {
            Swal.fire('Server Error', data.message || 'Failed to update.', 'error');
        }
    } catch (error) {
        Swal.fire('Network Error', 'Failed to reach server.', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span class="material-icons-outlined text-[20px] mr-2">save</span> Update Product';
    }
});