//1. LIVE VALIDATION LOGIC
document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');

    // Regex for Email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    function checkValidity() {
        const emailVal = emailInput.value.trim();
        const passVal = passwordInput.value.trim();

        let isEmailValid = false;
        let isPassValid = false;

        // Validate Email
        if (emailVal.length === 0) {
            // Empty: Don't show error yet if untouched, but invalid
            isEmailValid = false;
        } else if (!emailRegex.test(emailVal)) {
            emailError.innerText = "Please enter a valid email address";
            emailError.classList.remove('hidden');
            emailInput.classList.add('border-red-500', 'focus:ring-red-200');
            emailInput.classList.remove('border-slate-200', 'focus:ring-primary');
            isEmailValid = false;
        } else {
            emailError.classList.add('hidden');
            emailInput.classList.remove('border-red-500', 'focus:ring-red-200');
            emailInput.classList.add('border-green-500');
            isEmailValid = true;
        }

        // Validate Password
        if (passVal.length === 0) {
            // Don't error immediately if empty, just keep invalid
            isPassValid = false;
        } else {
            passwordError.classList.add('hidden');
            passwordInput.classList.remove('border-red-500');
            isPassValid = true;
        }

        // Enable/Disable Button
        if (isEmailValid && isPassValid) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('bg-gray-300', 'cursor-not-allowed');
            submitBtn.classList.add('bg-primary', 'hover:scale-[1.01]');
        } else {
            submitBtn.disabled = true;
            submitBtn.classList.add('bg-gray-300', 'cursor-not-allowed');
            submitBtn.classList.remove('bg-primary', 'hover:scale-[1.01]');
        }
    }

    // Listeners
    emailInput.addEventListener('keyup', checkValidity);
    passwordInput.addEventListener('keyup', checkValidity);

    // Trigger check on load in case of browser autofill
    setTimeout(checkValidity, 500);
});

//2. TOGGLE PASSWORD LOGIC
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerText = 'visibility';
        eyeIcon.classList.add('text-primary');
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerText = 'visibility_off';
        eyeIcon.classList.remove('text-primary');
    }
}
