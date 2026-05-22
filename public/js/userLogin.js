document.addEventListener("DOMContentLoaded", () => {
  const identifierInput = document.getElementById("identifier");
  const passwordInput = document.getElementById("password");
  const submitBtn = document.getElementById("submitBtn");
  const loginErrorMessage = document.getElementById("loginErrorMessage");

  const identifierError = document.getElementById("identifierError");
  const passwordError = document.getElementById("passwordError");
  const loginReason = new URLSearchParams(window.location.search).get("reason");
  const skipLoginReasonPopup =
    window.sessionStorage?.getItem("skipLoginReasonPopup") === "1";

  if (skipLoginReasonPopup) {
    window.sessionStorage.removeItem("skipLoginReasonPopup");
  }

  if (loginReason === "suspended" && window.Swal && !skipLoginReasonPopup) {
    Swal.fire({
      icon: "warning",
      title: "Account Suspended",
      text:
        loginErrorMessage?.textContent?.trim() ||
        "Admin suspended your account. Please contact support.",
      confirmButtonColor: "#e83e8c",
    });

    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Validation Function
  function checkValidity() {
    const identifierVal = identifierInput.value.trim();
    const passVal = passwordInput.value;

    let isIdentifierValid = false;
    let isPassValid = false;

    // 1. Validate Identifier (Email or Username)
    if (identifierVal.length === 0) {
      // Empty
      isIdentifierValid = false;
    } else if (identifierVal.length < 3) {
      // Too short
      identifierError.innerText = "Must be at least 3 characters";
      identifierError.classList.remove("hidden");
      identifierInput.classList.add("border-red-500");
      isIdentifierValid = false;
    } else {
      // Valid length
      identifierError.classList.add("hidden");
      identifierInput.classList.remove("border-red-500");
      isIdentifierValid = true;
    }

    // 2. Validate Password
    if (passVal.length === 0) {
      isPassValid = false;
    } else {
      // Just check if not empty for login
      passwordError.classList.add("hidden");
      passwordInput.classList.remove("border-red-500");
      isPassValid = true;
    }

    // 3. Toggle Button State
    if (isIdentifierValid && isPassValid) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("bg-gray-300", "cursor-not-allowed");
      submitBtn.classList.add("bg-primary", "hover:scale-[1.01]");
    } else {
      submitBtn.disabled = true;
      submitBtn.classList.add("bg-gray-300", "cursor-not-allowed");
      submitBtn.classList.remove("bg-primary", "hover:scale-[1.01]");
    }
  }

  // Attach Event Listeners
  identifierInput.addEventListener("keyup", checkValidity);
  passwordInput.addEventListener("keyup", checkValidity);

  // Initial check
  setTimeout(checkValidity, 500);
});

// Toggle Password Visibility Function (Global)
function togglePassword() {
  const passwordInput = document.getElementById("password");
  const eyeIcon = document.getElementById("eyeIcon");

  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    eyeIcon.innerText = "visibility";
    eyeIcon.classList.add("text-primary");
  } else {
    passwordInput.type = "password";
    eyeIcon.innerText = "visibility_off";
    eyeIcon.classList.remove("text-primary");
  }
}
