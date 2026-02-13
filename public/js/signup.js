// 1. Standard Error Popup
const showErrorAlert = (message) => {
    Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: message,
        confirmButtonColor: '#d33', // Red for errors
        confirmButtonText: 'Try Again'
    });
};

// 2. Toast Notification (for Resend OTP)
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});


document.addEventListener("DOMContentLoaded", () => {
    //  1. Form Submission 
    const form = document.getElementById("signupForm");
    const submitBtn = document.getElementById("submitBtn");

    if (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();

            const data = {
                firstName: document.getElementById("first-name").value.trim(),
                lastName: document.getElementById("last-name").value.trim(),
                email: document.getElementById("email").value.trim(),
                phone: document.getElementById("mobile").value.trim(),
                password: document.getElementById("password").value
            };

            try {
                showLoading();

                const res = await fetch("/send-signup-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });

                const result = await res.json();

                hideLoading();

                // Failure cases
                if (!result.success) {
                    // Check if it's a Google account error
                    if (result.message?.includes("Google")) {
                        Swal.fire({
                            icon: 'info',
                            title: 'Account Exists',
                            text: result.message,
                            showCancelButton: true,
                            confirmButtonText: 'Go to Login',
                            confirmButtonColor: '#db2777' //  primary pink
                        }).then((result) => {
                            if (result.isConfirmed) {
                                window.location.href = "/login";
                            }
                        });
                    } else {
                        showErrorAlert(result.message);
                    }
                    return;
                }

                // Success
                openOtpPopup();
                startOtpTimer();

                // Success Toast
                Toast.fire({
                    icon: 'success',
                    title: 'OTP Sent successfully'
                });

            } catch (error) {
                hideLoading();
                console.error(error);
                showErrorAlert("Server error. Please check your connection.");
            }
        });
    }
});


//  2. OTP Verification Logic

async function verifyOtp() {
    const inputs = document.querySelectorAll(".otp-input");
    let otp = "";
    inputs.forEach(input => otp += input.value);

    if (otp.length < 4) {
        // Validation error inside the modal
        const errorBox = document.getElementById("otpError");
        errorBox.innerText = "Please enter the full 4-digit code.";
        errorBox.classList.remove("hidden");
        return;
    }

    const email = document.getElementById("email").value.trim();
    const verifyBtn = document.getElementById("verifyBtn");

    try {
        const originalText = verifyBtn.innerText;
        verifyBtn.innerText = "Verifying...";
        verifyBtn.disabled = true;

        const res = await fetch("/verify-signup-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp })
        });

        const data = await res.json();

        verifyBtn.innerText = originalText;
        verifyBtn.disabled = false;

        if (data.success) {
            document.getElementById("otpError").classList.add("hidden");
            closeOtpPopup();

            openSuccessPopup();

            // Swal for success
            /*
            Swal.fire({
                icon: 'success',
                title: 'Account Created!',
                text: 'Your account has been successfully created.',
                confirmButtonText: 'Login Now',
                confirmButtonColor: '#db2777'
            }).then(() => {
                window.location.href = "/login";
            });
            */

        } else {
            const errorBox = document.getElementById("otpError");
            errorBox.innerText = data.message || "Invalid OTP";
            errorBox.classList.remove("hidden");
            clearOtpInputs();

            //  Shake the popup for visual feedback
            const popupContent = document.querySelector("#otpPopup > div");
            popupContent.classList.add('animate-shake');
            setTimeout(() => popupContent.classList.remove('animate-shake'), 500);
        }
    } catch (error) {
        console.error("Verification Error:", error);
        showErrorAlert("Something went wrong verifying OTP.");
        verifyBtn.disabled = false;
    }
}


//  3. Helper Functions

function showLoading() {
    const popup = document.getElementById("loadingPopup");
    if (popup) {
        popup.classList.remove("hidden");
        popup.classList.add("flex");
    }
}

function hideLoading() {
    const popup = document.getElementById("loadingPopup");
    if (popup) {
        popup.classList.add("hidden");
        popup.classList.remove("flex");
    }
}

function openOtpPopup() {
    const popup = document.getElementById("otpPopup");
    if (popup) {
        popup.classList.remove("hidden");
        popup.classList.add("flex");
        const firstInput = document.querySelector(".otp-input");
        if (firstInput) firstInput.focus();
    }
}

function closeOtpPopup() {
    const popup = document.getElementById("otpPopup");
    if (popup) {
        popup.classList.add("hidden");
        popup.classList.remove("flex");
        clearInterval(timerInterval);
    }
}

function openSuccessPopup() {
    const popup = document.getElementById("successPopup");
    if (popup) {
        popup.classList.remove("hidden");
        popup.classList.add("flex");
    }
}

function clearOtpInputs() {
    const inputs = document.querySelectorAll(".otp-input");
    inputs.forEach(input => input.value = "");
    inputs[0].focus();
}

function goToLogin() {
    window.location.href = "/login";
}

//  4. OTP Timer Logic 
let timerInterval;

function startOtpTimer() {
    let timeLeft = 60;
    const timerDisplay = document.getElementById("otpTimer");
    const timeoutMsg = document.getElementById("otpTimeoutMsg");
    const resendBtn = document.getElementById("resendOtpBtn");

    if (timerDisplay) {
        timerDisplay.innerHTML = `OTP expires in <span class="font-bold">${timeLeft}</span> seconds`;
        timerDisplay.classList.remove("hidden");
    }
    if (timeoutMsg) timeoutMsg.classList.add("hidden");

    if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.classList.add("opacity-50", "cursor-not-allowed");
    }

    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timeLeft--;

        if (timerDisplay) {
            timerDisplay.innerHTML = `OTP expires in <span class="font-bold">${timeLeft}</span> seconds`;
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (timerDisplay) timerDisplay.classList.add("hidden");
            if (timeoutMsg) timeoutMsg.classList.remove("hidden");

            if (resendBtn) {
                resendBtn.disabled = false;
                resendBtn.classList.remove("opacity-50", "cursor-not-allowed");
            }
        }
    }, 1000);
}

// Resend OTP Wrapper
async function resendOtp() {
    const email = document.getElementById("email").value.trim();
    if (!email) {
        showErrorAlert("Email is required to resend OTP.");
        return;
    }

    try {
        showLoading();
        // Change the URL to a specific resend endpoint
        const res = await fetch("/resend-signup-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }) // ONLY send the email
        });

        const result = await res.json();
        hideLoading();

        if (result.success) {
            Toast.fire({
                icon: 'success',
                title: 'New code sent to your email'
            });

            startOtpTimer();
            clearOtpInputs();
            document.getElementById("otpError").classList.add("hidden");
        } else {
            showErrorAlert(result.message);
        }
    } catch (err) {
        hideLoading();
        console.error(err);
        showErrorAlert("Failed to resend OTP.");
    }
}