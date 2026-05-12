function confirmLogout(redirectUrl) {
  Swal.fire({
    title: "Are you sure?",
    text: "You will be logged out of your session.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33", // Red for logout
    cancelButtonColor: "#3085d6", // Blue for cancel
    confirmButtonText: "Yes, Logout!",
    cancelButtonText: "Cancel",
    // Dark mode support checks
    background: document.documentElement.classList.contains("dark")
      ? "#1f2937"
      : "#fff",
    color: document.documentElement.classList.contains("dark")
      ? "#fff"
      : "#000",
  }).then((result) => {
    if (result.isConfirmed) {
      // Redirect to the URL passed as an argument
      window.location.href = redirectUrl;
    }
  });
}
