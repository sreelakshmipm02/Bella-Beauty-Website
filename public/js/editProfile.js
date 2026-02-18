// --- Modal Toggles ---
function openEditProfileModal() {
    document.getElementById('editProfileModal').classList.remove('hidden');
}
function closeEditProfileModal() {
    document.getElementById('editProfileModal').classList.add('hidden');
}

// --- Image Preview ---
function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('imagePreview').src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// --- Email Change Logic ---
let isEmailChanged = false;

function checkEmailChange(originalEmail) {
    const currentEmail = document.getElementById('editEmail').value.trim();
    const btn = document.getElementById('verifyEmailBtn');

    // Only enable Verify button if email is different AND valid regex
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (currentEmail !== originalEmail && emailPattern.test(currentEmail)) {
        btn.disabled = false;
        btn.classList.remove('bg-slate-400');
        btn.classList.add('bg-primary', 'hover:bg-pink-700');
        isEmailChanged = true;
    } else {
        btn.disabled = true;
        btn.classList.add('bg-slate-400');
        btn.classList.remove('bg-primary', 'hover:bg-pink-700');
        isEmailChanged = false;
    }
}

// --- Send OTP ---
async function sendUpdateOtp() {
    const newEmail = document.getElementById('editEmail').value;
    const btn = document.getElementById('verifyEmailBtn');

    btn.innerText = "Sending...";

    try {
        const res = await fetch('/user/update-email-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newEmail })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('updateEmailOtpModal').classList.remove('hidden');
            document.getElementById('updateEmailOtpModal').classList.add('flex');
            startUpdateTimer();
        } else {
            Swal.fire('Error', data.message, 'error');
        }
    } catch (err) {
        console.error(err);
    } finally {
        btn.innerText = "Verify";
    }
}

// --- Verify OTP ---
async function verifyEmailUpdate() {
    const inputs = document.querySelectorAll('.update-otp-input');
    let otp = "";
    inputs.forEach(i => otp += i.value);

    const newEmail = document.getElementById('editEmail').value;

    const res = await fetch('/user/verify-email-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail, otp })
    });
    const data = await res.json();

    if (data.success) {
        Swal.fire('Success', 'Email updated successfully', 'success');
        closeUpdateOtpModal();
        // Reset state so user can't verify again without changing
        document.getElementById('verifyEmailBtn').disabled = true;
        isEmailChanged = false;
    } else {
        Swal.fire('Error', data.message, 'error');
    }
}

// --- Main Form Submit (Profile Data) ---
async function handleProfileUpdate(e) {
    e.preventDefault();

    if (isEmailChanged) {
        return Swal.fire('Verify Email', 'Please verify your new email address before saving.', 'warning');
    }

    const form = document.getElementById('editProfileForm');
    const formData = new FormData(form); // Uses FormData for Image Upload

    // --- DEBUG CHECK ---
    const file = formData.get('profileImage');
    console.log("File selected:", file);
    // If this prints "null" or file size is 0, the input is empty or outside the form.
    // -------------------

    try {
        const res = await fetch('/user/update-profile', {
            method: 'PUT',
            body: formData // No Content-Type header needed for FormData
        });

        const data = await res.json();

        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: 'Saved',
                text: 'Profile updated successfully',
                timer: 1500,
                showConfirmButton: false
            }).then(() => location.reload());
        } else {
            Swal.fire('Error', data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Something went wrong', 'error');
    }
}

// --- OTP Handling Utilities (Timer & Input Focus) ---
function closeUpdateOtpModal() {
    document.getElementById('updateEmailOtpModal').classList.add('hidden');
    document.getElementById('updateEmailOtpModal').classList.remove('flex');
}

function startUpdateTimer() {
    let timeLeft = 60;
    const timerEl = document.getElementById('updateOtpTimer');
    const interval = setInterval(() => {
        timeLeft--;
        timerEl.innerText = `Expires in ${timeLeft}s`;
        if (timeLeft <= 0) clearInterval(interval);
    }, 1000);
}

// Auto-focus logic for OTP inputs
document.querySelectorAll('.update-otp-input').forEach((input, index, inputs) => {
    input.addEventListener('input', (e) => {
        if (e.target.value && index < inputs.length - 1) inputs[index + 1].focus();
    });
});