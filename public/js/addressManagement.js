let autocomplete;

// 1. Initialize Google Autocomplete
function initAutocomplete() {
    const input = document.getElementById("addressLine1");

    // Restrict results to India (since your default country is India)
    const options = {
        componentRestrictions: { country: "in" },
        fields: ["address_components", "geometry", "icon", "name"],
        types: ["address"] // Suggest precise addresses, not just cities
    };

    autocomplete = new google.maps.places.Autocomplete(input, options);

    // When the user selects an address from the dropdown, populate the form
    autocomplete.addListener("place_changed", fillInAddress);
}

// 2. Parse Google's Response and Fill Form
function fillInAddress() {
    const place = autocomplete.getPlace();

    // Map Google's internal names to your form IDs
    const componentForm = {
        street_number: 'short_name',
        route: 'long_name',
        locality: 'long_name', // City
        administrative_area_level_1: 'long_name', // State
        postal_code: 'short_name' // Pincode
    };

    // Clear existing values
    document.getElementById("city").value = "";
    document.getElementById("state").value = "";
    document.getElementById("postalCode").value = "";
    document.getElementById("addressLine2").value = "";

    let streetAddress = "";

    // Loop through the components Google returned
    for (const component of place.address_components) {
        const addressType = component.types[0];

        if (componentForm[addressType]) {
            const val = component[componentForm[addressType]];

            // Logic to build the address line
            if (addressType === "street_number") {
                streetAddress = val + " ";
            } else if (addressType === "route") {
                streetAddress += val;
            } else if (addressType === "locality") {
                document.getElementById("city").value = val;
            } else if (addressType === "administrative_area_level_1") {
                document.getElementById("state").value = val;
            } else if (addressType === "postal_code") {
                document.getElementById("postalCode").value = val;
            }
        }
    }

    // Set the constructed street address to Address Line 1
    // (If Google only gave a street name, use it. If user typed "123 Main St", Google returns both)
    if (streetAddress) {
        document.getElementById("addressLine1").value = streetAddress;
    }

    // Move cursor to Address Line 2 (Optional) for apartment number
    document.getElementById("addressLine2").focus();
}

//-----------------------------------------------------------------------------------------------------
// --- Modal Logic ---
function openAddressModal() {
    const modal = document.getElementById('addressModal');
    const form = document.getElementById('addressForm');
    const title = document.getElementById('modalTitle');

    // Reset form for "Add New" state
    form.reset();
    document.getElementById('addressId').value = '';
    title.innerText = 'Add New Address';

    modal.classList.remove('hidden');
}

function closeAddressModal() {
    document.getElementById('addressModal').classList.add('hidden');
}

// --- Submit Logic (Add & Edit) ---
async function handleAddressSubmit(event) {
    event.preventDefault();

    //1. Regex Validation Layer
    const phone = document.getElementById('phone').value;
    const postalCode = document.getElementById('postalCode').value;

    // Validate Phone (Indian 10-digit)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
        return Swal.fire('Invalid Phone', 'Please enter a valid 10-digit Indian mobile number.', 'error');
    }

    // Validate Pincode (6-digit)
    // Even if Google fills it, sometimes it might be empty for new areas
    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!pinRegex.test(postalCode)) {
        return Swal.fire('Invalid Pincode', 'Please enter a valid 6-digit Pincode.', 'error');
    }
    // 2. Collect Data
    const formData = {
        addressId: document.getElementById('addressId').value,
        fullName: document.getElementById('fullName').value,
        phone: document.getElementById('phone').value,
        addressLine1: document.getElementById('addressLine1').value,
        addressLine2: document.getElementById('addressLine2').value,
        city: document.getElementById('city').value,
        state: document.getElementById('state').value,
        postalCode: document.getElementById('postalCode').value,
        country: document.getElementById('country').value,
        isDefault: document.getElementById('isDefault').checked
    };


    // 3. Determine Endpoint (Add vs Edit)
    const url = formData.addressId
        ? `/address/edit/${formData.addressId}`
        : '/address/add';

    const method = formData.addressId ? 'PUT' : 'POST';

    // 4. Send Request
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Address saved successfully.',
                timer: 1500,
                showConfirmButton: false
            }).then(() => location.reload()); // Reload to show new address
        } else {
            Swal.fire('Error', result.message || 'Failed to save address', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('Error', 'Something went wrong', 'error');
    }
}

// --- Edit Logic (Populate Modal) ---
async function editAddress(addressId) {
    try {
        // Fetch current address details
        const response = await fetch(`/address/${addressId}`);
        const data = await response.json();

        if (data.success) {
            const addr = data.address;

            // Populate Fields
            document.getElementById('addressId').value = addr._id;
            document.getElementById('fullName').value = addr.fullName;
            document.getElementById('phone').value = addr.phone;
            document.getElementById('addressLine1').value = addr.addressLine1;
            document.getElementById('addressLine2').value = addr.addressLine2 || '';
            document.getElementById('city').value = addr.city;
            document.getElementById('state').value = addr.state;
            document.getElementById('postalCode').value = addr.postalCode;
            document.getElementById('isDefault').checked = addr.isDefault;

            // Update UI text
            document.getElementById('modalTitle').innerText = 'Edit Address';

            // Show Modal
            document.getElementById('addressModal').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

// --- Delete Logic ---
async function deleteAddress(addressId) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/address/delete/${addressId}`, { method: 'DELETE' });
            const data = await response.json();

            if (data.success) {
                Swal.fire('Deleted!', 'Address has been deleted.', 'success')
                    .then(() => location.reload());
            } else {
                Swal.fire('Error', data.message, 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Server error', 'error');
        }
    }
}

// --- Set Default Logic ---
async function setDefault(addressId) {
    try {
        const response = await fetch(`/address/set-default/${addressId}`, { method: 'PATCH' });
        const data = await response.json();

        if (data.success) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Default address updated',
                showConfirmButton: false,
                timer: 1500
            }).then(() => location.reload());
        }
    } catch (error) {
        console.error('Error:', error);
    }
}