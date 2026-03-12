async function updateStatus(userId) {
    try {
        // Show a confirmation dialog before blocking
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You want to change this user's account status!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#E91E63',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, change it!'
        });

        if (result.isConfirmed) {
            const response = await fetch(`/admin/user/${userId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                // Success Toast notification
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `User status updated to ${data.newStatus}`,
                    showConfirmButton: false,
                    timer: 2000
                });

                // RELOAD only the table content or just reload the page for simplicity
                // For a better UX, we reload the location to show updated buttons/badges
                window.location.reload();
            } else {
                Swal.fire('Error!', data.message || 'Failed to update status', 'error');
            }
        }
    } catch (error) {
        console.error('Error updating status:', error);
        Swal.fire('Error!', 'Something went wrong with the server.', 'error');
    }
}
// Searchbar elements
const searchInput = document.getElementById('userSearch');
const statusFilter = document.getElementById('statusFilter');
const clearSearchBtn = document.getElementById('clearSearchBtn');

function applyFilters() {
    // Safety check in case they are missing
    const searchValue = searchInput ? searchInput.value.trim() : '';
    const statusValue = statusFilter ? statusFilter.value : '';
    window.location.href = `/admin/user?status=${statusValue}&search=${searchValue}`;
}

// --- SAFE LISTENERS ---
// Only attach these if the searchInput actually exists on the screen!
if (searchInput) {
    // Watch for typing to show/hide the X button
    searchInput.addEventListener('input', function() {
        if (clearSearchBtn) { // Double check the button exists too
            if (this.value.trim().length > 0) {
                clearSearchBtn.classList.remove('hidden');
            } else {
                clearSearchBtn.classList.add('hidden');
            }
        }
    });

    // Trigger search on Enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
}

// Only attach if the status filter dropdown exists!
if (statusFilter) {
    statusFilter.addEventListener('change', applyFilters);
}

// --- Clear Search Logic ---
function clearSearch() {
    if (searchInput) searchInput.value = '';
    if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
    applyFilters();
}