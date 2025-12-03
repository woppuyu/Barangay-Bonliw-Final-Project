// Check if user is logged in
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
  window.location.href = '/#login';
}

// Check if user is approved (residents only)
if (user.role === 'resident') {
  fetch('/api/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(data => {
    if (!data.approved) {
      window.location.href = '/pending-approval';
    }
  })
  .catch(err => console.error('Error checking approval status:', err));
}

// Display user info
function formatUserName(user) {
  const mi = user.middle_name ? user.middle_name.charAt(0).toUpperCase() + '.' : '';
  return `${user.first_name}${mi ? ' ' + mi : ''} ${user.last_name}`;
}
document.getElementById('userInfo').textContent = `Welcome, ${formatUserName(user)}`;
document.getElementById('sidebarUserName').textContent = formatUserName(user);

// Set role text
const isAdmin = user.role === 'admin';
document.getElementById('sidebarRole').textContent = isAdmin ? 'Administrator' : 'Resident Dashboard';

// Populate sidebar menu based on role
const sidebarMenu = document.getElementById('sidebarMenu');
if (isAdmin) {
  sidebarMenu.innerHTML = `
    <li><a href="/admin">Manage Appointments</a></li>
    <li><a href="/manage-users">Manage Users</a></li>
    <li><a href="/admin-stats">Statistics</a></li>
    <li><a href="/settings">Settings</a></li>
    <li><button id="logoutBtn" class="logout">Logout</button></li>
  `;
} else {
  sidebarMenu.innerHTML = `
    <li><a href="/dashboard">My Appointments</a></li>
    <li><a href="/dashboard#book">Book Appointment</a></li>
    <li><a href="/settings">Settings</a></li>
    <li><button id="logoutBtn" class="logout">Logout</button></li>
  `;
}

// Highlight active menu item after populating menu
const currentPath = window.location.pathname;
const menuLinks = sidebarMenu.querySelectorAll('a');
menuLinks.forEach(link => {
  const linkPath = new URL(link.href).pathname;
  if (linkPath === currentPath) {
    link.classList.add('active');
  }
});

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

// Load current user data
async function loadUserData() {
  try {
    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const userData = await response.json();
      
      // Populate basic info form
      document.getElementById('first_name').value = userData.first_name || '';
      document.getElementById('last_name').value = userData.last_name || '';
      document.getElementById('middle_name').value = userData.middle_name || '';
      document.getElementById('phone').value = userData.phone || '';
      document.getElementById('address').value = userData.address || '';
      
      // Show current username and email
      document.getElementById('current_username').value = userData.username || '';
      document.getElementById('current_email').value = userData.email || 'No email set';
    } else {
      throw new Error('Failed to load user data');
    }
  } catch (error) {
    showAlertModal('Error', 'Failed to load your account information');
  }
}

// Update basic information
document.getElementById('basicInfoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const messageDiv = document.getElementById('message');
  if (messageDiv) messageDiv.innerHTML = '';

  const formData = {
    first_name: document.getElementById('first_name').value.trim(),
    last_name: document.getElementById('last_name').value.trim(),
    middle_name: document.getElementById('middle_name').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    address: document.getElementById('address').value.trim()
  };

  try {
    const response = await fetch('/api/auth/update-profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (response.ok) {
      // Update localStorage
      user.first_name = formData.first_name;
      user.last_name = formData.last_name;
      user.middle_name = formData.middle_name;
      localStorage.setItem('user', JSON.stringify(user));
      showToast('✅ Profile updated successfully!', 'success');
      document.getElementById('userInfo').textContent = `Welcome, ${formatUserName(formData)}`;
      document.getElementById('sidebarUserName').textContent = formatUserName(formData);
    } else {
      showToast(data.error || 'Update failed', 'error');
    }
  } catch (error) {
    showToast('An error occurred. Please try again.', 'error');
  }
});

// Change username
document.getElementById('usernameForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const messageDiv = document.getElementById('message');
  if (messageDiv) messageDiv.innerHTML = '';

  const newUsername = document.getElementById('new_username').value.trim();

  showConfirmModal(
    'Change Username',
    `Are you sure you want to change your username to "${newUsername}"?`,
    async () => {
      try {
        const response = await fetch('/api/auth/update-username', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ new_username: newUsername })
        });

        const data = await response.json();

        if (response.ok) {
          user.username = newUsername;
          localStorage.setItem('user', JSON.stringify(user));
          
          document.getElementById('current_username').value = newUsername;
          document.getElementById('new_username').value = '';
          showToast('✅ Username changed successfully!', 'success');
        } else {
          showToast(data.error || 'Username change failed', 'error');
        }
      } catch (error) {
        showToast('An error occurred. Please try again.', 'error');
      }
    }
  );
});

// Send verification code for email change
document.getElementById('sendCodeBtn').addEventListener('click', async () => {
  const messageDiv = document.getElementById('message');
  if (messageDiv) messageDiv.innerHTML = '';
  
  const newEmail = document.getElementById('new_email').value.trim();
  
  if (!newEmail) {
    showToast('Please enter a new email address', 'error');
    return;
  }

  try {
    const response = await fetch('/api/auth/send-email-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ new_email: newEmail })
    });

    const data = await response.json();

    if (response.ok) {
      showToast('✅ Verification code sent to your new email!', 'success');
      document.getElementById('verifyEmailForm').style.display = 'block';
      document.getElementById('sendCodeBtn').disabled = true;
      document.getElementById('new_email').disabled = true;
    } else {
      showToast(data.error || 'Failed to send verification code', 'error');
    }
  } catch (error) {
    showToast('An error occurred. Please try again.', 'error');
  }
});

// Verify and update email
document.getElementById('verifyEmailForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const messageDiv = document.getElementById('message');
  if (messageDiv) messageDiv.innerHTML = '';

  const code = document.getElementById('verification_code').value.trim();
  const newEmail = document.getElementById('new_email').value.trim();

  try {
    const response = await fetch('/api/auth/verify-and-update-email', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ code, new_email: newEmail })
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById('current_email').value = newEmail;
      document.getElementById('new_email').value = '';
      document.getElementById('new_email').disabled = false;
      document.getElementById('verification_code').value = '';
      document.getElementById('verifyEmailForm').style.display = 'none';
      document.getElementById('sendCodeBtn').disabled = false;
      showToast('✅ Email updated successfully!', 'success');
    } else {
      showToast(data.error || 'Verification failed', 'error');
    }
  } catch (error) {
    showToast('An error occurred. Please try again.', 'error');
  }
});

// Cancel verification
document.getElementById('cancelVerifyBtn').addEventListener('click', () => {
  document.getElementById('verifyEmailForm').style.display = 'none';
  document.getElementById('sendCodeBtn').disabled = false;
  document.getElementById('new_email').disabled = false;
  document.getElementById('new_email').value = '';
  document.getElementById('verification_code').value = '';
});

// Change password
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const messageDiv = document.getElementById('message');
  if (messageDiv) messageDiv.innerHTML = '';

  const currentPassword = document.getElementById('current_password').value;
  const newPassword = document.getElementById('new_password').value;
  const confirmPassword = document.getElementById('confirm_password').value;

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match', 'error');
    return;
  }

  if (newPassword.length < 8) {
    showToast('New password must be at least 8 characters', 'error');
    return;
  }

  try {
    const response = await fetch('/api/auth/update-password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      })
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById('passwordForm').reset();
      showToast('✅ Password changed successfully!', 'success');
    } else {
      showToast(data.error || 'Password change failed', 'error');
    }
  } catch (error) {
    showToast('An error occurred. Please try again.', 'error');
  }
});

// --- Notification Bell Logic ---
const notifBell = document.getElementById('notifBell');
const notifDropdown = document.getElementById('notifDropdown');
const notifCount = document.getElementById('notifCount');

let notifications = [];

function renderNotifications() {
  if (!notifDropdown) return;
  notifDropdown.innerHTML = '';
  if (notifications.length === 0) {
    notifDropdown.innerHTML = '<div class="notif-empty">No notifications</div>';
    notifCount.style.display = 'none';
  } else {
    notifications.forEach((notif, idx) => {
      const item = document.createElement('div');
      item.className = 'notif-item';
      item.innerHTML = notif.text;
      notifDropdown.appendChild(item);
    });
    // Format all time displays
    notifDropdown.querySelectorAll('.time-display').forEach(el => {
      el.textContent = formatTime(el.textContent);
    });
    notifCount.textContent = notifications.length;
    notifCount.style.display = 'inline-block';
  }
}

function toggleNotifDropdown() {
  if (!notifDropdown) return;
  notifDropdown.style.display = notifDropdown.style.display === 'none' ? 'block' : 'none';
}

if (notifBell) {
  notifBell.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNotifDropdown();
  });
  document.addEventListener('click', (e) => {
    if (notifDropdown && notifDropdown.style.display === 'block') {
      notifDropdown.style.display = 'none';
    }
  });
}

// Fetch notifications from backend
async function fetchNotifications() {
  try {
    const response = await fetch('/api/notifications', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (response.ok) {
      notifications = await response.json();
    } else {
      notifications = [];
    }
  } catch (err) {
    notifications = [];
  }
  renderNotifications();
}

// Initial fetch
fetchNotifications();

// Re-render notifications when time format changes
window.addEventListener('timeFormatChanged', () => {
  renderNotifications();
});

// Load user data on page load
loadUserData();
