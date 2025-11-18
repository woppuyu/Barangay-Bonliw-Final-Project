// Check if user is logged in and is admin
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
  window.location.href = '/#login';
}

if (user.role !== 'admin') {
  window.location.href = '/dashboard';
}

// Display user info
document.getElementById('userInfo').textContent = `Welcome, ${user.full_name}`;
document.getElementById('sidebarUserName').textContent = user.full_name;

// Burger menu toggle
const burgerToggle = document.getElementById('burgerToggle');
const sidebarNav = document.getElementById('sidebarNav');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function openSidebar() {
  sidebarNav.classList.add('active');
  sidebarOverlay.classList.add('active');
  burgerToggle.classList.add('active');
}

function closeSidebar() {
  sidebarNav.classList.remove('active');
  sidebarOverlay.classList.remove('active');
  burgerToggle.classList.remove('active');
}

burgerToggle.addEventListener('click', () => {
  if (sidebarNav.classList.contains('active')) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

sidebarOverlay.addEventListener('click', closeSidebar);

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
});

// State
let allUsers = [];
let currentFilter = 'pending';

// Friendly date formatter
function formatDate(value) {
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const dt = new Date(value);
    return isNaN(dt) ? value : dt.toLocaleDateString(undefined, opts);
  }
  const dt = new Date(value);
  return isNaN(dt) ? value : dt.toLocaleDateString(undefined, opts);
}

// Load all users
async function loadUsers() {
  const container = document.getElementById('usersContainer');
  
  try {
    const response = await fetch('/api/auth/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    allUsers = await response.json();
    updateCounts();
    renderUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    container.innerHTML = '<div class="alert alert-error">Failed to load users.</div>';
  }
}

// Update badge counts
function updateCounts() {
  const pending = allUsers.filter(u => !u.approved).length;
  const approved = allUsers.filter(u => u.approved).length;
  
  document.getElementById('pendingCount').textContent = pending;
  document.getElementById('approvedCount').textContent = approved;
  document.getElementById('allCount').textContent = allUsers.length;
}

// Render users based on filter
function renderUsers() {
  const container = document.getElementById('usersContainer');
  
  let filteredUsers = allUsers;
  if (currentFilter === 'pending') {
    filteredUsers = allUsers.filter(u => !u.approved);
  } else if (currentFilter === 'approved') {
    filteredUsers = allUsers.filter(u => u.approved);
  }

  if (filteredUsers.length === 0) {
    const emptyMessage = currentFilter === 'pending' 
      ? 'No pending users. All users are approved!' 
      : currentFilter === 'approved'
      ? 'No approved users yet.'
      : 'No users found.';
    container.innerHTML = `<div class="empty-state"><p>${emptyMessage}</p></div>`;
    return;
  }

  let html = '<div style="overflow-x: auto;"><table><thead><tr>';
  html += '<th>Status</th>';
  html += '<th>Username</th>';
  html += '<th>Full Name</th>';
  html += '<th>Email</th>';
  html += '<th>Phone</th>';
  html += '<th>Address</th>';
  html += '<th>Registered</th>';
  html += '<th>Actions</th>';
  html += '</tr></thead><tbody>';

  filteredUsers.forEach(u => {
    const statusClass = u.approved ? 'status-approved' : 'status-pending';
    const statusText = u.approved ? 'APPROVED' : 'PENDING';
    
    html += `<tr>`;
    html += `<td><span class="status ${statusClass}">${statusText}</span></td>`;
    html += `<td>${u.username}</td>`;
    html += `<td>${u.full_name}</td>`;
    html += `<td>${u.email || '-'}</td>`;
    html += `<td>${u.phone || '-'}</td>`;
    html += `<td>${u.address || '-'}</td>`;
    html += `<td>${formatDate(u.created_at)}</td>`;
    html += `<td style="white-space: nowrap;">`;
    
    if (!u.approved) {
      html += `<button class="btn btn-success" style="font-size: 12px; padding: 6px 12px; margin-right: 4px;" onclick="approveUser(${u.id})">Approve</button>`;
    } else {
      html += `<button class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px; margin-right: 4px;" onclick="revokeUser(${u.id})">Revoke</button>`;
    }
    
    html += `<button class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; margin-right: 4px;" onclick="openEditModal(${u.id})">Edit</button>`;
    html += `<button class="btn btn-danger" style="font-size: 12px; padding: 6px 12px;" onclick="deleteUser(${u.id}, '${u.username}')">Delete</button>`;
    html += `</td>`;
    html += `</tr>`;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// Filter tabs
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderUsers();
  });
});

// Approve user
async function approveUser(userId) {
  const confirmed = await showConfirmModal(
    'Approve User',
    'Are you sure you want to approve this user? They will gain access to all features.'
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`/api/auth/users/${userId}/approve`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      showToast('User approved successfully!', 'success');
      loadUsers();
    } else {
      showToast(data.error || 'Failed to approve user', 'error');
    }
  } catch (error) {
    showToast('Failed to approve user', 'error');
    console.error('Error:', error);
  }
}

// Revoke approval
async function revokeUser(userId) {
  const confirmed = await showConfirmModal(
    'Revoke Approval',
    'Are you sure you want to revoke this user\'s approval? They will lose access to features.'
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`/api/auth/users/${userId}/revoke`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      showToast('User approval revoked', 'success');
      loadUsers();
    } else {
      showToast(data.error || 'Failed to revoke approval', 'error');
    }
  } catch (error) {
    showToast('Failed to revoke approval', 'error');
    console.error('Error:', error);
  }
}

// Open edit modal
function openEditModal(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('editUserId').value = user.id;
  document.getElementById('editFullName').value = user.full_name;
  document.getElementById('editEmail').value = user.email || '';
  document.getElementById('editPhone').value = user.phone || '';
  document.getElementById('editAddress').value = user.address || '';

  document.getElementById('editUserModal').classList.add('active');
  document.body.classList.add('modal-open');
}

// Close edit modal
document.getElementById('cancelEditBtn').addEventListener('click', () => {
  document.getElementById('editUserModal').classList.remove('active');
  document.body.classList.remove('modal-open');
});

// Handle edit form submission
document.getElementById('editUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const userId = document.getElementById('editUserId').value;
  const formData = {
    full_name: document.getElementById('editFullName').value,
    email: document.getElementById('editEmail').value,
    phone: document.getElementById('editPhone').value,
    address: document.getElementById('editAddress').value
  };

  try {
    const response = await fetch(`/api/auth/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (response.ok) {
      showToast('User updated successfully!', 'success');
      document.getElementById('editUserModal').classList.remove('active');
      document.body.classList.remove('modal-open');
      loadUsers();
    } else {
      showToast(data.error || 'Failed to update user', 'error');
    }
  } catch (error) {
    showToast('Failed to update user', 'error');
    console.error('Error:', error);
  }
});

// Delete user
async function deleteUser(userId, username) {
  const confirmed = await showConfirmModal(
    'Delete User',
    `Are you sure you want to permanently delete user "${username}"? This action cannot be undone and will also delete all their appointments.`
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`/api/auth/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      showToast('User deleted successfully', 'success');
      loadUsers();
    } else {
      showToast(data.error || 'Failed to delete user', 'error');
    }
  } catch (error) {
    showToast('Failed to delete user', 'error');
    console.error('Error:', error);
  }
}

// Load users on page load
loadUsers();
