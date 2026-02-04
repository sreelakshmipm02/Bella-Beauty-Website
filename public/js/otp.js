//spinner loading 
function showLoading() {
    document.getElementById("loadingPopup").classList.remove("hidden");
    document.getElementById("loadingPopup").classList.add("flex");
}

function hideLoading() {
    document.getElementById("loadingPopup").classList.add("hidden");
    document.getElementById("loadingPopup").classList.remove("flex");
}

function openOtpPopup() {
    const popup = document.getElementById("otpPopup");
    const errorBox = document.getElementById("otpError");
    const timeoutMsg = document.getElementById("otpTimeoutMsg");
    const resendBtn = document.getElementById("resendOtpBtn");
    const verifyBtn = document.getElementById("verifyBtn");

    // reset UI state
    errorBox.classList.add("hidden");
    errorBox.innerText = "";

    timeoutMsg.classList.add("hidden");
    resendBtn.classList.remove("hidden");;
    verifyBtn.disabled = false;

    clearOtpInputs();   // clear previous OTP inputs

    popup.classList.remove("hidden");
    popup.classList.add("flex");

    startOtpTimer();   // restart timer
}


function closeOtpPopup() {
    const popup = document.getElementById("otpPopup");
    const errorBox = document.getElementById("otpError");

    errorBox.classList.add("hidden");
    errorBox.innerText = "";

    popup.classList.add("hidden");
    popup.classList.remove("flex");

    clearInterval(otpTimerInterval); // stop timer
}


//sign up success popup
function openSuccessPopup() {
    document.getElementById("successPopup").classList.remove("hidden");
    document.getElementById("successPopup").classList.add("flex");
}

function goToLogin() {
    window.location.href = "/login";
}

// --- OTP Input Logic (Typing, Backspace, Paste) ---
document.addEventListener("DOMContentLoaded", () => {
    const inputs = document.querySelectorAll(".otp-input");

    inputs.forEach((input, index) => {
        // 1. Handle Typing (Move to next)
        input.addEventListener("input", (e) => {
            const value = e.target.value;

            // Allow only numbers
            if (isNaN(value)) {
                e.target.value = "";
                return;
            }

            // Move to next input if a digit is entered
            if (value && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        // 2. Handle Backspace (Move to previous)
        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace") {
                // If the current box is empty, move focus back to the previous one
                if (!e.target.value && index > 0) {
                    inputs[index - 1].focus();
                }
            }
        });

        // 3. Handle Copy-Paste
        input.addEventListener("paste", (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData("text").trim();

            // Check if pasted content is only numbers
            if (!/^\d+$/.test(pasteData)) return;

            // Distribute digits to inputs
            pasteData.split("").forEach((char, i) => {
                if (inputs[i]) {
                    inputs[i].value = char;
                }
            });

            // Focus the last filled input
            const nextEmptyIndex = Math.min(pasteData.length, inputs.length - 1);
            inputs[nextEmptyIndex].focus();
        });
    });
});

//clear OTP
function clearOtpInputs() {
    const inputs = document.querySelectorAll(".otp-input");

    inputs.forEach(input => input.value = "");
    inputs[0].focus();
}


//timer and resend otp button
let otpTimerInterval;
let otpTimeLeft = 60;

function startOtpTimer() {
    otpTimeLeft = 60;
    updateOtpTimerUI();

    otpTimerInterval = setInterval(() => {
        otpTimeLeft--;

        updateOtpTimerUI();

        if (otpTimeLeft <= 0) {
            clearInterval(otpTimerInterval);
            expireOtp();
        }
    }, 1000);
}

function updateOtpTimerUI() {
    const timerEl = document.getElementById("otpTimer");
    timerEl.innerHTML = `OTP expires in <span class="font-bold">${otpTimeLeft}</span> seconds`;
}

function expireOtp() {
    clearOtpInputs();
    document.getElementById("verifyBtn").disabled = true;
    document.getElementById("otpTimeoutMsg").classList.remove("hidden");
    document.getElementById("resendOtpBtn").classList.remove("hidden");
}


async function resendOtp() {
    try {
        clearInterval(otpTimerInterval);   // stop old timer
        clearOtpInputs();                  // clear input boxes

        // Reset UI
        document.getElementById("verifyBtn").disabled = false;
        document.getElementById("otpTimeoutMsg").classList.add("hidden");

        const errorBox = document.getElementById("otpError");
        errorBox.classList.add("hidden");
        errorBox.innerText = "";

        // Show loading spinner
        showLoading();

        // Call backend again
        const email = document.getElementById("email").value.trim();

        const res = await fetch("/send-signup-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const result = await res.json();
        hideLoading();

        if (result.success) {
            startOtpTimer();   // restart timer
            alert("New OTP sent to your email");
        } else {
            alert(result.message || "Failed to resend OTP");
        }

    } catch (error) {
        hideLoading();
        console.error(error);
        alert("Server error while resending OTP");
    }
}

