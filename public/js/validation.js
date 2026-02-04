document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signupForm');
    const submitBtn = document.getElementById('submitBtn');

    // Input fields
    const inputs = {
        firstName: document.getElementById('first-name'),
        lastName: document.getElementById('last-name'),
        email: document.getElementById('email'),
        phone: document.getElementById('mobile'),
        password: document.getElementById('password'),
        confirmPassword: document.getElementById('confirm-password')
    };

    // Error display elements
    const errors = {
        firstName: document.getElementById('firstNameError'),
        lastName: document.getElementById('lastNameError'),
        email: document.getElementById('emailError'),
        phone: document.getElementById('mobileError'),
        password: document.getElementById('passwordError'),
        confirmPassword: document.getElementById('confirmPasswordError')
    };

    // Validation Regex Patterns
    const patterns = {
        name: /^[a-zA-Z\s]{2,50}$/, // Letters only, min 2 chars
        email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Standard email
        phone: /^[6-9]\d{9}$/, // Indian mobile format (starts with 6-9, 10 digits total)
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/ // Strong password
    };

    // Messages
    const messages = {
        name: "Must contain only letters (min 2 chars)",
        email: "Please enter a valid email address",
        phone: "Enter a valid 10-digit mobile number",
        password: "Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol",
        confirmPassword: "Passwords do not match"
    };

    // Validation State
    const validState = {
        firstName: false,
        lastName: false, // Optional, can be true by default if you allow empty
        email: false,
        phone: false,
        password: false,
        confirmPassword: false
    };

    // --- Helper Functions ---

    const showError = (field, message) => {
        errors[field].innerText = message;
        inputs[field].classList.add('border-red-500', 'focus:ring-red-200');
        inputs[field].classList.remove('border-gray-200', 'focus:ring-primary/20', 'border-green-500');
        validState[field] = false;
        checkFormValidity();
    };

    const showSuccess = (field) => {
        errors[field].innerText = "";
        inputs[field].classList.remove('border-red-500', 'focus:ring-red-200');
        inputs[field].classList.add('border-green-500'); // Optional: Green border on success
        validState[field] = true;
        checkFormValidity();
    };

    const checkFormValidity = () => {
        // Check if all required fields are valid
        const allValid = Object.values(validState).every(status => status === true);

        if (allValid) {
            submitBtn.removeAttribute('disabled');
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            submitBtn.setAttribute('disabled', 'true');
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    };

    // --- Live Event Listeners ---

    // 1. First Name
    inputs.firstName.addEventListener('keyup', (e) => {
        const value = e.target.value.trim();
        if (!patterns.name.test(value)) {
            showError('firstName', messages.name);
        } else {
            showSuccess('firstName');
        }
    });

    // 2. Last Name
    inputs.lastName.addEventListener('keyup', (e) => {
        const value = e.target.value.trim();
        // Last name validation (Optional: can be stricter if needed)
        if (value.length > 0 && !patterns.name.test(value)) {
            showError('lastName', messages.name);
        } else {
            // Note: If last name is optional, logic changes. Assuming required here:
            if (value.length === 0) showError('lastName', "Last name is required");
            else showSuccess('lastName');
        }
    });

    // 3. Email
    inputs.email.addEventListener('keyup', (e) => {
        const value = e.target.value.trim();
        if (!patterns.email.test(value)) {
            showError('email', messages.email);
        } else {
            showSuccess('email');
        }
    });

    // 4. Phone
    inputs.phone.addEventListener('keyup', (e) => {
        const value = e.target.value.trim();
        if (!patterns.phone.test(value)) {
            showError('phone', messages.phone);
        } else {
            showSuccess('phone');
        }
    });

    // 5. Password
    inputs.password.addEventListener('keyup', (e) => {
        const value = e.target.value;
        if (!patterns.password.test(value)) {
            showError('password', messages.password);
        } else {
            showSuccess('password');
            // Re-validate confirm password if it has a value
            if (inputs.confirmPassword.value) {
                if (inputs.confirmPassword.value !== value) {
                    showError('confirmPassword', messages.confirmPassword);
                } else {
                    showSuccess('confirmPassword');
                }
            }
        }
    });

    // 6. Confirm Password
    inputs.confirmPassword.addEventListener('keyup', (e) => {
        const value = e.target.value;
        const passValue = inputs.password.value;

        if (!value) {
            showError('confirmPassword', "Please confirm your password");
        } else if (value !== passValue) {
            showError('confirmPassword', messages.confirmPassword);
        } else {
            showSuccess('confirmPassword');
        }
    });
});

// --- Password Toggle Function (Global) ---
function togglePassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);

    if (input.type === "password") {
        input.type = "text";
        icon.innerText = "visibility"; // Show eye open
        icon.classList.add('text-primary');
    } else {
        input.type = "password";
        icon.innerText = "visibility_off"; // Show eye closed
        icon.classList.remove('text-primary');
    }
}