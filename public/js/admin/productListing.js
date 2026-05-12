document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("productSearch");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");
  let searchTimeout;

  // Apply Filters Function
  function applyFilters() {
    const searchValue = searchInput.value.trim();
    const categoryValue = categoryFilter.value;
    const statusValue = statusFilter.value;

    let url = "/admin/products?";
    if (searchValue) url += `search=${encodeURIComponent(searchValue)}&`;
    if (categoryValue !== "all") url += `category=${categoryValue}&`;
    if (statusValue !== "all") url += `status=${statusValue}&`;

    window.location.href = url.replace(/&$/, ""); // Redirect to filtered URL
  }

  // Event Listeners
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applyFilters, 500); // Debounce typing
    });
  }

  if (categoryFilter) categoryFilter.addEventListener("change", applyFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
});

// Clear Search Function
function clearProductSearch() {
  document.getElementById("productSearch").value = "";
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.delete("search");
  window.location.search = urlParams.toString();
}

// Soft Delete / Toggle Status
async function toggleProductStatus(productId, currentStatus) {
  const action = currentStatus === "active" ? "deactivate" : "activate";

  const result = await Swal.fire({
    title: `Are you sure?`,
    text: `Do you want to ${action} this product?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#e83e8c",
    cancelButtonColor: "#64748b",
    confirmButtonText: `Yes, ${action} it!`,
  });

  if (result.isConfirmed) {
    try {
      // Send PATCH request to toggle status
      const response = await fetch(`/admin/products/${productId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (data.success) {
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: data.message,
          showConfirmButton: false,
          timer: 2000,
        }).then(() => location.reload()); // Reload to see updated UI
      } else {
        Swal.fire("Error", data.message, "error");
      }
    } catch (error) {
      Swal.fire("Error", "Server error while updating status.", "error");
    }
  }
}
