// --- Modal Toggles ---
function openEditProfileModal() {
  document.getElementById("editProfileModal").classList.remove("hidden");
}
function closeEditProfileModal() {
  document.getElementById("editProfileModal").classList.add("hidden");
}

// --- Image Preview ---
function previewImage(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById("imagePreview").src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// --- Email Change Logic ---
let isEmailChanged = false;

function checkEmailChange(originalEmail) {
  const currentEmail = document.getElementById("editEmail").value.trim();
  const btn = document.getElementById("verifyEmailBtn");

  // Only enable Verify button if email is different AND valid regex
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (currentEmail !== originalEmail && emailPattern.test(currentEmail)) {
    btn.disabled = false;
    btn.classList.remove("bg-slate-400");
    btn.classList.add("bg-primary", "hover:bg-pink-700");
    isEmailChanged = true;
  } else {
    btn.disabled = true;
    btn.classList.add("bg-slate-400");
    btn.classList.remove("bg-primary", "hover:bg-pink-700");
    isEmailChanged = false;
  }
}

// --- Send OTP ---
async function sendUpdateOtp() {
  const newEmail = document.getElementById("editEmail").value;
  const btn = document.getElementById("verifyEmailBtn");

  btn.innerText = "Sending...";

  try {
    const res = await fetch("/email/otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail }),
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById("updateEmailOtpModal").classList.remove("hidden");
      document.getElementById("updateEmailOtpModal").classList.add("flex");
      startUpdateTimer();
    } else {
      Swal.fire("Error", data.message, "error");
    }
  } catch (err) {
    console.error(err);
  } finally {
    btn.innerText = "Verify";
  }
}

// --- Verify OTP ---
async function verifyEmailUpdate() {
  const inputs = document.querySelectorAll(".update-otp-input");
  let otp = "";
  inputs.forEach((i) => (otp += i.value));

  const newEmail = document.getElementById("editEmail").value;

  const res = await fetch("/email", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newEmail, otp }),
  });
  const data = await res.json();

  if (data.success) {
    Swal.fire("Success", "Email updated successfully", "success");
    closeUpdateOtpModal();
    // Reset state so user can't verify again without changing
    document.getElementById("verifyEmailBtn").disabled = true;
    isEmailChanged = false;
  } else {
    Swal.fire("Error", data.message, "error");
  }
}

// --- Main Form Submit (Profile Data) ---
async function handleProfileUpdate(e) {
  e.preventDefault();

  // 1. Clear any previous error messages
  document.getElementById("editFirstNameError").innerText = "";
  document.getElementById("editLastNameError").innerText = "";
  document.getElementById("editPhoneError").innerText = "";
  document.getElementById("editEmailError").innerText = "";

  const form = document.getElementById("editProfileForm");
  const formData = new FormData(form);

  // 2. Extract values for validation
  const firstName = formData.get("firstName").trim();
  const lastName = formData.get("lastName").trim();
  const phone = formData.get("phone").trim();
  const email = formData.get("email").trim();
  const firstNameInput = document.getElementById("editFirstName");
  const lastNameInput = document.getElementById("editLastName");
  const phoneInput = document.getElementById("editPhone");
  const emailInput = document.getElementById("editEmail");

  let isValid = true;

  // 3. Validate First Name (Letters only, min 2 chars)
  if (!/^[a-zA-Z\s]{2,50}$/.test(firstName)) {
    window.BellaForms?.setFieldError(
      firstNameInput,
      "First name should contain only letters and be at least 2 characters.",
      "editFirstNameError",
    );
    isValid = false;
  } else {
    window.BellaForms?.clearFieldError(firstNameInput, "editFirstNameError");
  }

  // 4. Validate Last Name (Letters only, min 1 char)
  if (!/^[a-zA-Z\s]{1,50}$/.test(lastName)) {
    window.BellaForms?.setFieldError(
      lastNameInput,
      "Last name should contain only letters.",
      "editLastNameError",
    );
    isValid = false;
  } else {
    window.BellaForms?.clearFieldError(lastNameInput, "editLastNameError");
  }

  // 5. Validate Phone (Indian 10-digit)
  if (!/^[6-9]\d{9}$/.test(phone)) {
    window.BellaForms?.setFieldError(
      phoneInput,
      "Enter a valid 10-digit mobile number.",
      "editPhoneError",
    );
    isValid = false;
  } else {
    window.BellaForms?.clearFieldError(phoneInput, "editPhoneError");
  }

  // 6. Validate Email
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    window.BellaForms?.setFieldError(
      emailInput,
      "Please enter a valid email address.",
      "editEmailError",
    );
    isValid = false;
  } else {
    window.BellaForms?.clearFieldError(emailInput, "editEmailError");
  }
  // Stop execution if validation fails
  if (!isValid) return;

  if (isEmailChanged) {
    return Swal.fire(
      "Verify Email",
      "Please verify your new email address before saving.",
      "warning",
    );
  }

  try {
    showLoading();

    const res = await fetch("/profile", {
      method: "PUT",
      body: formData,
    });

    const data = await res.json();
    hideLoading();

    if (data.success) {
      Swal.fire({
        icon: "success",
        title: "Saved",
        text: "Profile updated successfully",
        timer: 1500,
        showConfirmButton: false,
      }).then(() => location.reload());
    } else {
      Swal.fire("Error", data.message, "error");
    }
  } catch (err) {
    hideLoading();
    console.error(err);
    Swal.fire("Error", "Something went wrong", "error");
  }
}
// Clear errors when the user starts typing again
document
  .getElementById("editFirstName")
  .addEventListener(
    "input",
    (event) =>
      window.BellaForms?.clearFieldError(
        event.target,
        "editFirstNameError",
      ),
  );
document
  .getElementById("editLastName")
  .addEventListener(
    "input",
    (event) =>
      window.BellaForms?.clearFieldError(event.target, "editLastNameError"),
  ); // <-- ADD THIS LINE
document
  .getElementById("editPhone")
  .addEventListener(
    "input",
    (event) =>
      window.BellaForms?.clearFieldError(event.target, "editPhoneError"),
  );
document
  .getElementById("editEmail")
  .addEventListener(
    "input",
    (event) =>
      window.BellaForms?.clearFieldError(event.target, "editEmailError"),
  );

// --- OTP Handling Utilities (Timer & Input Focus) ---
function closeUpdateOtpModal() {
  document.getElementById("updateEmailOtpModal").classList.add("hidden");
  document.getElementById("updateEmailOtpModal").classList.remove("flex");
}

function startUpdateTimer() {
  let timeLeft = 60;
  const timerEl = document.getElementById("updateOtpTimer");
  const interval = setInterval(() => {
    timeLeft--;
    timerEl.innerText = `Expires in ${timeLeft}s`;
    if (timeLeft <= 0) clearInterval(interval);
  }, 1000);
}

// --- Auto-focus, Backspace, and Paste logic for OTP inputs ---
document
  .querySelectorAll(".update-otp-input")
  .forEach((input, index, inputs) => {
    // 1. Handle Typing (Move to next & numbers only)
    input.addEventListener("input", (e) => {
      // Allow only numbers
      if (isNaN(e.target.value)) {
        e.target.value = "";
        return;
      }
      // Move to the next input if a number is typed
      if (e.target.value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    // 2. Handle Backspace (Move to previous)
    input.addEventListener("keydown", (e) => {
      // If backspace is pressed on an empty box, go back
      if (e.key === "Backspace" && !e.target.value && index > 0) {
        inputs[index - 1].focus();
      }
    });

    // 3. Handle Copy-Paste
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData("text").trim();

      // Check if pasted content is strictly numbers
      if (!/^\d+$/.test(pasteData)) return;

      // Distribute each digit into the separate input boxes
      pasteData.split("").forEach((char, i) => {
        if (inputs[i]) {
          inputs[i].value = char;
        }
      });

      // Focus the last filled input box
      const nextEmptyIndex = Math.min(pasteData.length, inputs.length) - 1;
      if (inputs[nextEmptyIndex]) {
        inputs[nextEmptyIndex].focus();
      }
    });
  });

// Loading Spinner Utilities
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
