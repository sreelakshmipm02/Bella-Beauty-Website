// Add this to your user.ejs
async function updateStatus(userId) {
    try {
        // Show a confirmation dialog before blocking
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You want to change this user's account status!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#E91E63', // Your primary pink
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, change it!'
        });

        if (result.isConfirmed) {
            const response = await fetch(`/admin/user/toggle-status/${userId}`, {
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

//status filter option
document.getElementById('statusFilter').addEventListener('change', function () {
    const selectedStatus = this.value;
    // Redirect to the same page but with a ?status= query parameter
    window.location.href = `/admin/user?status=${selectedStatus}`;
});

//searchbar option
const searchInput = document.getElementById('userSearch');
const statusFilter = document.getElementById('statusFilter');

function applyFilters() {
    const searchValue = searchInput.value.trim();
    const statusValue = statusFilter.value;

    // Build URL with multiple parameters
    window.location.href = `/admin/user?status=${statusValue}&search=${searchValue}`;
}

// Trigger search on Enter key
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyFilters();
});

// Update results when status changes
statusFilter.addEventListener('change', applyFilters);