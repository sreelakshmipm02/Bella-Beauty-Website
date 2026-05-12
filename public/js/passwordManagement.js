async function handlePasswordUpdate(e) {
  e.preventDefault();

  const currentPass = document.getElementById("currentPassword").value;
  const newPass = document.getElementById("newPassword").value;
  const confirmPass = document.getElementById("confirmPassword").value;
  const btn = document.getElementById("savePasswordBtn");

  // Reset Errors
  document.getElementById("currentError").innerText = "";
  document.getElementById("newError").innerText = "";
  document.getElementById("confirmError").innerText = "";

  let isValid = true;

  if (!currentPass) {
    document.getElementById("currentError").innerText =
      "Current password is required";
    isValid = false;
  }

  const passRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passRegex.test(newPass)) {
    document.getElementById("newError").innerText =
      "Password does not meet requirements.";
    isValid = false;
  }

  if (newPass !== confirmPass) {
    document.getElementById("confirmError").innerText =
      "Passwords do not match.";
    isValid = false;
  }

  if (!isValid) return;

  try {
    btn.innerText = "Updating...";
    btn.disabled = true;

    const res = await fetch("/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: currentPass,
        newPassword: newPass,
      }),
    });

    const data = await res.json();

    if (data.success) {
      Swal.fire({
        icon: "success",
        title: "Success!",
        text: "Your password has been updated.",
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        document.getElementById("passwordForm").reset();
      });
    } else {
      Swal.fire("Error", data.message, "error");
    }
  } catch (err) {
    Swal.fire("Error", "Something went wrong on the server.", "error");
  } finally {
    btn.innerText = "Update Password";
    btn.disabled = false;
  }
}

// Clear errors on input
document
  .getElementById("currentPassword")
  .addEventListener(
    "input",
    () => (document.getElementById("currentError").innerText = ""),
  );
document
  .getElementById("newPassword")
  .addEventListener(
    "input",
    () => (document.getElementById("newError").innerText = ""),
  );
document
  .getElementById("confirmPassword")
  .addEventListener(
    "input",
    () => (document.getElementById("confirmError").innerText = ""),
  );

// --- Forgot Current Password Logic ---
async function handleForgotCurrentPassword() {
  const result = await Swal.fire({
    title: "Reset Password?",
    text: "We will send a reset link to your email and securely log you out.",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#E91E63", // Primary pink
    cancelButtonColor: "#94a3b8",
    confirmButtonText: "Yes, send link",
  });

  if (result.isConfirmed) {
    try {
      // Show loading state
      Swal.fire({
        title: "Sending Link...",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const res = await fetch("/password/forgot", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "Link Sent!",
          text: "Check your email. You have been logged out securely.",
          timer: 3000,
          showConfirmButton: false,
        }).then(() => {
          // Redirect to login page after logout
          window.location.href = "/login";
        });
      } else {
        Swal.fire("Error", data.message, "error");
      }
    } catch (error) {
      Swal.fire("Error", "Something went wrong.", "error");
    }
  }
}
