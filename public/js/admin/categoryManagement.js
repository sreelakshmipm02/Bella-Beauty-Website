// ==============================================================================
// CATEGORY MANAGEMENT JAVASCRIPT
// Handles all Category and Attribute CRUD operations via AJAX Modals
// ==============================================================================

// ==========================================
// 1. Search & Filter Logic (Main Page)
// ==========================================
const categorySearchInput = document.getElementById("categorySearch");
const statusFilter = document.getElementById("statusFilter");

// Trigger search on 'Enter' key press
if (categorySearchInput) {
  categorySearchInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") updateFilters();
  });
}

// Trigger filter on status change
if (statusFilter) {
  statusFilter.addEventListener("change", updateFilters);
}

// Clear search input and reload
function clearSearch() {
  document.getElementById("categorySearch").value = "";
  updateFilters();
}

// Apply filters by reloading the page with query parameters
function updateFilters() {
  const search = document.getElementById("categorySearch").value.trim();
  const status = document.getElementById("statusFilter").value;
  window.location.href = `/admin/category?search=${encodeURIComponent(search)}&status=${status}`;
}

// ==========================================
// 2. Soft Delete Category Logic (Main Page)
// ==========================================
async function softDeleteCategory(categoryId) {
  const result = await Swal.fire({
    title: "Are you sure?",
    text: "Do you want to change the status of this category?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#e83e8c",
    cancelButtonColor: "#64748b",
    confirmButtonText: "Yes, proceed!",
  });

  if (result.isConfirmed) {
    try {
      const response = await fetch(`/admin/category/${categoryId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.success) {
        await Swal.fire({
          title: "Updated!",
          text: `Category has been ${data.newStatus === "active" ? "restored" : "soft deleted"}.`,
          icon: "success",
          confirmButtonColor: "#e83e8c",
        });
        window.location.reload();
      } else {
        Swal.fire(
          "Error!",
          data.message || "Failed to update category.",
          "error",
        );
      }
    } catch (error) {
      console.error("Error:", error);
      Swal.fire("Error!", "A network error occurred.", "error");
    }
  }
}

// ==========================================
// 3. Global Attribute Management (Shared Logic)
// Functions for Creating, Editing, Deleting, and Searching Attributes
// ==========================================

// --- Form Validation Helpers ---
function validateCategoryInput(name, description, imageFile) {
  if (!name || name.trim().length < 3)
    return "Category name must be at least 3 characters long.";
  if (/[^a-zA-Z0-9\s\-_&]/.test(name))
    return "Category name contains invalid special characters.";
  // UPDATED: Only validate the description if the admin actually typed something in it
  if (
    description &&
    description.trim().length > 0 &&
    description.trim().length < 10
  ) {
    return "If you provide a description, it must be at least 10 characters long.";
  }
  if (imageFile && imageFile.name) {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(imageFile.type))
      return "Please upload a valid image file (JPEG, PNG, WEBP).";
    if (imageFile.size > 5 * 1024 * 1024)
      return "Image size must be less than 5MB.";
  }
  return null;
}

function validateAttributeInput(label, internalName, dataType, possibleValues) {
  if (!label || label.trim().length < 2)
    return "Display label must be at least 2 characters long.";

  // NEW: Check if the internal name generated successfully
  if (!internalName || internalName.trim().length === 0) {
    return "Display label must contain at least one letter or number to generate a valid internal name.";
  }

  if (
    (dataType === "enum" || dataType === "array") &&
    (!possibleValues || !possibleValues.trim())
  ) {
    return "Possible values are required for Dropdown and Multiple Select data types.";
  }
  return null;
}

// --- Search Attributes (Add Category Modal) ---
function filterCategoryAttributes() {
  const input = document.getElementById("attributeSearchInput");
  const filter = input.value.toUpperCase();
  const container = document.getElementById("attributeCheckboxList");
  if (!container) return; // Fail safe

  const items = container.getElementsByClassName("attribute-list-item");

  for (let i = 0; i < items.length; i++) {
    const nameSpan = items[i].getElementsByClassName("attr-display-name")[0];
    const txtValue = nameSpan.textContent || nameSpan.innerText;
    items[i].style.display =
      txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
  }
}

// --- Search Attributes (Edit Category Modal) ---
function filterEditCategoryAttributes() {
  const input = document.getElementById("editAttributeSearchInput");
  const filter = input.value.toUpperCase();
  const container = document.getElementById("editAttributeCheckboxList");
  if (!container) return; // Fail safe

  const items = container.getElementsByClassName("attribute-list-item");

  for (let i = 0; i < items.length; i++) {
    const nameSpan = items[i].getElementsByClassName("attr-display-name")[0];
    const txtValue = nameSpan.textContent || nameSpan.innerText;
    items[i].style.display =
      txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
  }
}

// --- Delete Global Attribute ---
async function deleteGlobalAttribute(attributeId, buttonElement) {
  const result = await Swal.fire({
    title: "Delete this attribute?",
    text: "This will permanently remove it from the global pool.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#64748b",
    confirmButtonText: "Yes, delete it!",
  });

  if (result.isConfirmed) {
    try {
      const response = await fetch(`/admin/attributes/${attributeId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        const listItem = buttonElement.closest(".attribute-list-item");
        if (listItem) listItem.remove();

        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Attribute deleted successfully",
          showConfirmButton: false,
          timer: 2000,
        });
      } else {
        Swal.fire("Error", data.message, "error");
      }
    } catch (error) {
      Swal.fire("Error", "A network error occurred.", "error");
    }
  }
}

// --- Create Attribute Modal Controls ---
function openCreateAttributeModal() {
  const modal = document.getElementById("createAttributeModal");
  const backdrop = document.getElementById("createAttrBackdrop");
  const panel = document.getElementById("createAttrPanel");

  if (!modal) return alert("Error: Attribute modal HTML is missing.");

  modal.classList.remove("hidden");
  setTimeout(() => {
    backdrop.classList.remove("opacity-0");
    panel.classList.remove("opacity-0", "translate-y-4", "sm:scale-95");
  }, 10);
}

function closeCreateAttributeModal() {
  const modal = document.getElementById("createAttributeModal");
  const backdrop = document.getElementById("createAttrBackdrop");
  const panel = document.getElementById("createAttrPanel");

  backdrop.classList.add("opacity-0");
  panel.classList.add("opacity-0", "translate-y-4", "sm:scale-95");
  setTimeout(() => {
    modal.classList.add("hidden");
    document.getElementById("createAttributeForm").reset();
    document.getElementById("createAttrError").classList.add("hidden");
    toggleAttrValuesInput();
  }, 300);
}

// Generate internal name for Create Modal
function generateInternalAttrName() {
  const label = document.getElementById("attrDisplayLabel").value;
  document.getElementById("attrInternalName").value = label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// Show/Hide possible values input for Create Modal
function toggleAttrValuesInput() {
  const dataType = document.getElementById("attrDataType").value;
  const container = document.getElementById("attrValuesContainer");
  const input = document.getElementById("attrPossibleValues");

  if (dataType === "enum" || dataType === "array") {
    container.classList.remove("hidden");
    input.setAttribute("required", "true");
  } else {
    container.classList.add("hidden");
    input.removeAttribute("required");
    input.value = "";
  }
}

// Submit Create Attribute Form
async function submitNewAttribute(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById("saveNewAttrBtn");
  const errorDiv = document.getElementById("createAttrError");
  const errorText = document.getElementById("createAttrErrorText");

  // --- VALIDATION LOGIC ---
  const label = form.displayLabel.value;
  const internalName = form.internalName.value; // Grab the internal name
  const dataType = form.dataType.value;
  const possibleValues = form.possibleValues ? form.possibleValues.value : "";

  // Pass internalName into the validator
  const validationError = validateAttributeInput(
    label,
    internalName,
    dataType,
    possibleValues,
  );
  if (validationError) {
    errorText.textContent = validationError;
    errorDiv.classList.remove("hidden");
    return;
  }
  // --- END VALIDATION LOGIC ---

  btn.disabled = true;
  btn.innerHTML = "Saving...";
  errorDiv.classList.add("hidden");

  const formData = new FormData(form);
  const dataObj = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/admin/attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataObj),
    });
    const data = await response.json();

    if (data.success && data.attribute) {
      closeCreateAttributeModal();

      const newCheckboxHTML = `
                <div class="attribute-list-item flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600 group">
                    <label class="flex items-center cursor-pointer flex-grow">
                        <input type="checkbox" name="categoryAttributes[]" value="${data.attribute._id}" checked class="w-4 h-4 text-[#e83e8c] bg-slate-100 border-slate-300 rounded focus:ring-[#e83e8c] dark:bg-slate-700 dark:border-slate-600">
                        <div class="ml-3 flex flex-col">
                            <span class="attr-display-name text-sm font-medium text-slate-900 dark:text-white">${data.attribute.displayLabel}</span>
                            <span class="text-xs text-slate-500">${data.attribute.dataType}</span>
                        </div>
                    </label>
                    <div class="flex opacity-0 group-hover:opacity-100 transition-all">
                        <button type="button" onclick="openEditGlobalAttribute('${data.attribute._id}')" class="text-slate-400 hover:text-blue-500 p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Edit Attribute">
                            <span class="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button type="button" onclick="deleteGlobalAttribute('${data.attribute._id}', this)" class="text-slate-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete Attribute">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                </div>
            `;

      const addContainer = document.getElementById("attributeCheckboxList");
      if (addContainer) {
        const emptyMsg = document.getElementById("emptyAttributeMsg");
        if (emptyMsg) emptyMsg.remove();
        addContainer.insertAdjacentHTML("afterbegin", newCheckboxHTML);
      }

      const editContainer = document.getElementById(
        "editAttributeCheckboxList",
      );
      if (editContainer) {
        editContainer.insertAdjacentHTML("afterbegin", newCheckboxHTML);
      }

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Attribute Created & Selected!",
        showConfirmButton: false,
        timer: 2000,
      });
    } else {
      errorText.textContent = data.message;
      errorDiv.classList.remove("hidden");
    }
  } catch (error) {
    errorText.textContent = "A network error occurred.";
    errorDiv.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Save Attribute";
  }
}

// --- Edit Attribute Modal Controls ---
async function openEditGlobalAttribute(attributeId) {
  const modal = document.getElementById("editAttributeModal");
  const backdrop = document.getElementById("editAttrBackdrop");
  const panel = document.getElementById("editAttrPanel");

  try {
    const response = await fetch(`/admin/attributes/${attributeId}`);
    const data = await response.json();

    if (data.success) {
      const attr = data.attribute;

      document.getElementById("editAttrId").value = attr._id;
      document.getElementById("editAttrDisplayLabel").value = attr.displayLabel;
      document.getElementById("editAttrInternalName").value = attr.internalName;
      document.getElementById("editAttrDataType").value = attr.dataType;

      if (attr.possibleValues && attr.possibleValues.length > 0) {
        document.getElementById("editAttrPossibleValues").value =
          attr.possibleValues.join(", ");
      } else {
        document.getElementById("editAttrPossibleValues").value = "";
      }

      toggleEditAttrValuesInput();

      modal.classList.remove("hidden");
      setTimeout(() => {
        backdrop.classList.remove("opacity-0");
        panel.classList.remove("opacity-0", "translate-y-4", "sm:scale-95");
      }, 10);
    }
  } catch (error) {
    Swal.fire("Error", "Failed to fetch attribute data.", "error");
  }
}

function closeEditAttributeModal() {
  const modal = document.getElementById("editAttributeModal");
  const backdrop = document.getElementById("editAttrBackdrop");
  const panel = document.getElementById("editAttrPanel");

  backdrop.classList.add("opacity-0");
  panel.classList.add("opacity-0", "translate-y-4", "sm:scale-95");
  setTimeout(() => {
    modal.classList.add("hidden");
    document.getElementById("editAttributeForm").reset();
    document.getElementById("editAttrError").classList.add("hidden");
  }, 300);
}

// Generate internal name for Edit Modal
function generateEditInternalAttrName() {
  const label = document.getElementById("editAttrDisplayLabel").value;
  document.getElementById("editAttrInternalName").value = label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// Show/Hide possible values input for Edit Modal
function toggleEditAttrValuesInput() {
  const dataType = document.getElementById("editAttrDataType").value;
  const container = document.getElementById("editAttrValuesContainer");
  const input = document.getElementById("editAttrPossibleValues");

  if (dataType === "enum" || dataType === "array") {
    container.classList.remove("hidden");
    input.setAttribute("required", "true");
  } else {
    container.classList.add("hidden");
    input.removeAttribute("required");
  }
}

// Submit Edit Attribute Form
async function submitEditAttributeForm(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById("updateAttrBtn");
  const errorDiv = document.getElementById("editAttrError");
  const errorText = document.getElementById("editAttrErrorText");
  const attributeId = document.getElementById("editAttrId").value;

  // --- VALIDATION LOGIC ---
  const label = form.displayLabel.value;
  const internalName = form.internalName.value; // Grab the internal name
  const dataType = form.dataType.value;
  const possibleValues = form.possibleValues ? form.possibleValues.value : "";

  // Pass internalName into the validator
  const validationError = validateAttributeInput(
    label,
    internalName,
    dataType,
    possibleValues,
  );
  if (validationError) {
    errorText.textContent = validationError;
    errorDiv.classList.remove("hidden");
    return;
  }
  // --- END VALIDATION LOGIC ---

  btn.disabled = true;
  btn.innerHTML = "Updating...";
  errorDiv.classList.add("hidden");

  const formData = new FormData(form);
  const dataObj = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(`/admin/attributes/${attributeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataObj),
    });
    const data = await response.json();

    if (data.success) {
      closeEditAttributeModal();

      // NEW: Dynamically update the attribute name in the checkbox lists
      // without reloading the page so the Edit Category modal stays open.
      const checkboxes = document.querySelectorAll(
        `input[value="${attributeId}"]`,
      );
      checkboxes.forEach((cb) => {
        const labelContainer = cb.closest("label");
        if (labelContainer) {
          const nameSpan = labelContainer.querySelector(".attr-display-name");
          if (nameSpan) {
            nameSpan.textContent = label; // Updates with the newly typed label
          }
        }
      });

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Attribute Updated!",
        showConfirmButton: false,
        timer: 1500,
      });
      // REMOVED: .then(() => window.location.reload());
    } else {
      document.getElementById("editAttrErrorText").textContent = data.message;
      document.getElementById("editAttrError").classList.remove("hidden");
    }
  } catch (error) {
    document.getElementById("editAttrErrorText").textContent = "Network error.";
    document.getElementById("editAttrError").classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Update Attribute";
  }
}

// ==========================================
// 4. Add Category Logic
// ==========================================
function openAddCategoryModal() {
  const addModal = document.getElementById("addCategoryModal");
  const addBackdrop = document.getElementById("addModalBackdrop");
  const addPanel = document.getElementById("addModalPanel");

  if (!addModal) return;

  addModal.classList.remove("hidden");
  setTimeout(() => {
    addBackdrop.classList.remove("opacity-0");
    addPanel.classList.remove("opacity-0", "translate-y-4", "sm:scale-95");
  }, 10);
}

function toggleImageFieldState(
  previewId,
  placeholderId,
  overlayId,
  imageSrc = "",
) {
  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);
  const overlay = overlayId ? document.getElementById(overlayId) : null;
  const hasImage = Boolean(imageSrc);

  preview.src = imageSrc;
  preview.classList.toggle("hidden", !hasImage);
  placeholder.classList.toggle("hidden", hasImage);

  if (overlay) {
    overlay.classList.toggle("hidden", !hasImage);
  }
}

function closeAddCategoryModal() {
  const addModal = document.getElementById("addCategoryModal");
  const addBackdrop = document.getElementById("addModalBackdrop");
  const addPanel = document.getElementById("addModalPanel");

  addBackdrop.classList.add("opacity-0");
  addPanel.classList.add("opacity-0", "translate-y-4", "sm:scale-95");

  setTimeout(() => {
    addModal.classList.add("hidden");
    document.getElementById("addCategoryForm").reset();

    const checkboxes = document.querySelectorAll(
      '#attributeCheckboxList input[type="checkbox"]',
    );
    checkboxes.forEach((cb) => (cb.checked = false));

    toggleImageFieldState(
      "imagePreview",
      "uploadPlaceholder",
      "imagePreviewOverlay",
    );
    document.getElementById("addCategoryError").classList.add("hidden");
  }, 300);
}

function previewCategoryImage(event) {
  const input = event.target;

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      toggleImageFieldState(
        "imagePreview",
        "uploadPlaceholder",
        "imagePreviewOverlay",
        e.target.result,
      );
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    toggleImageFieldState(
      "imagePreview",
      "uploadPlaceholder",
      "imagePreviewOverlay",
    );
  }
}

// Submit Add Category Form
async function submitCategoryForm(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = document.getElementById("saveCategoryBtn");
  const errorDiv = document.getElementById("addCategoryError");
  const errorText = document.getElementById("addCategoryErrorText");

  // --- VALIDATION LOGIC ---
  const name = form.name.value;
  const description = form.description.value;
  const imageFile = form.categoryImage.files[0];

  const validationError = validateCategoryInput(name, description, imageFile);
  if (validationError) {
    errorText.textContent = validationError;
    errorDiv.classList.remove("hidden");
    return;
  }
  // --- END VALIDATION LOGIC ---

  submitBtn.disabled = true;
  submitBtn.innerHTML =
    '<span class="material-symbols-outlined animate-spin text-[18px] mr-2">progress_activity</span> Saving...';
  errorDiv.classList.add("hidden");

  const formData = new FormData(form);
  if (!document.getElementById("statusCheckbox").checked)
    formData.set("status", "inactive");

  try {
    const response = await fetch("/admin/category", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      closeAddCategoryModal();
      Swal.fire({
        title: "Success!",
        text: "Category added successfully.",
        icon: "success",
        confirmButtonColor: "#e83e8c",
      }).then(() => window.location.reload());
    } else {
      errorText.textContent = data.message || "Failed to add category.";
      errorDiv.classList.remove("hidden");
    }
  } catch (error) {
    errorText.textContent =
      "A network error occurred. Please check your connection.";
    errorDiv.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML =
      '<span class="material-symbols-outlined text-[18px] mr-2">save</span> Save Category';
  }
}

// ==========================================
// 5. Edit Category Logic
// ==========================================
async function openEditCategoryModal(categoryId) {
  const modal = document.getElementById("editCategoryModal");
  const backdrop = document.getElementById("editModalBackdrop");
  const panel = document.getElementById("editModalPanel");

  try {
    const response = await fetch(`/admin/category/${categoryId}`);
    const data = await response.json();

    if (data.success) {
      const cat = data.category;

      document.getElementById("editCategoryId").value = cat._id;
      document.getElementById("editCategoryName").value = cat.name;
      document.getElementById("editCategoryDescription").value =
        cat.description;

      const statusCb = document.getElementById("editStatusCheckbox");
      if (statusCb) {
        statusCb.checked = cat.status === "active";
      }

      if (cat.categoryImage) {
        let imgPath = "";
        if (cat.categoryImage.startsWith("http")) {
          imgPath = cat.categoryImage;
        } else {
          let cleanPath = cat.categoryImage.replace(/\\/g, "/");
          if (cleanPath.startsWith("public/")) {
            cleanPath = cleanPath.substring(7);
          }
          imgPath = cleanPath.startsWith("/") ? cleanPath : "/" + cleanPath;
        }

        toggleImageFieldState(
          "editImagePreview",
          "editUploadPlaceholder",
          "editImagePreviewOverlay",
          imgPath,
        );
      } else {
        toggleImageFieldState(
          "editImagePreview",
          "editUploadPlaceholder",
          "editImagePreviewOverlay",
        );
      }

      const checkboxes = document.querySelectorAll(
        '#editAttributeCheckboxList input[type="checkbox"]',
      );
      checkboxes.forEach((cb) => {
        cb.checked = cat.categoryAttributes.includes(cb.value);
      });

      modal.classList.remove("hidden");
      setTimeout(() => {
        backdrop.classList.remove("opacity-0");
        panel.classList.remove("opacity-0", "translate-y-4", "sm:scale-95");
      }, 10);
    } else {
      Swal.fire("Error", "Could not load category data.", "error");
    }
  } catch (error) {
    console.error("REAL FETCH ERROR:", error);
    Swal.fire("Error", "Network error while fetching category.", "error");
  }
}

function closeEditCategoryModal() {
  const modal = document.getElementById("editCategoryModal");
  const backdrop = document.getElementById("editModalBackdrop");
  const panel = document.getElementById("editModalPanel");

  backdrop.classList.add("opacity-0");
  panel.classList.add("opacity-0", "translate-y-4", "sm:scale-95");

  setTimeout(() => {
    modal.classList.add("hidden");
    document.getElementById("editCategoryForm").reset();
    toggleImageFieldState(
      "editImagePreview",
      "editUploadPlaceholder",
      "editImagePreviewOverlay",
    );
    document.getElementById("editCategoryError").classList.add("hidden");
  }, 300);
}

function previewEditCategoryImage(event) {
  const input = event.target;

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      toggleImageFieldState(
        "editImagePreview",
        "editUploadPlaceholder",
        "editImagePreviewOverlay",
        e.target.result,
      );
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    toggleImageFieldState(
      "editImagePreview",
      "editUploadPlaceholder",
      "editImagePreviewOverlay",
    );
  }
}

// Submit Edit Category Form
async function submitEditCategoryForm(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById("updateCategoryBtn");
  const errorDiv = document.getElementById("editCategoryError");
  const errorText = document.getElementById("editCategoryErrorText");
  const categoryId = document.getElementById("editCategoryId").value;

  // --- VALIDATION LOGIC ---
  const name = form.name.value;
  const description = form.description.value;
  const imageFile = form.categoryImage.files[0];

  const validationError = validateCategoryInput(name, description, imageFile);
  if (validationError) {
    errorText.textContent = validationError;
    errorDiv.classList.remove("hidden");
    return;
  }
  // --- END VALIDATION LOGIC ---

  btn.disabled = true;
  btn.innerHTML =
    '<span class="material-symbols-outlined animate-spin mr-2">progress_activity</span> Updating...';
  errorDiv.classList.add("hidden");

  const formData = new FormData(form);

  const statusCb = document.getElementById("editStatusCheckbox");
  if (statusCb && !statusCb.checked) {
    formData.set("status", "inactive");
  } else {
    formData.set("status", "active");
  }

  try {
    const response = await fetch(`/admin/category/${categoryId}`, {
      method: "PUT",
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      closeEditCategoryModal();
      Swal.fire({
        title: "Success!",
        text: "Category updated successfully.",
        icon: "success",
        confirmButtonColor: "#e83e8c",
      }).then(() => window.location.reload());
    } else {
      document.getElementById("editCategoryErrorText").textContent =
        data.message;
      document.getElementById("editCategoryError").classList.remove("hidden");
    }
  } catch (error) {
    document.getElementById("editCategoryErrorText").textContent =
      "A network error occurred.";
    document.getElementById("editCategoryError").classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.innerHTML =
      '<span class="material-symbols-outlined text-[18px] mr-2">save</span> Update Category';
  }
}
