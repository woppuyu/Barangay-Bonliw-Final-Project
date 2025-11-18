// Check if user is logged in
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
  window.location.href = '/#login';
}

// Display user info
document.getElementById('userInfo').textContent = `Welcome, ${user.full_name}`;
document.getElementById('sidebarUserName').textContent = user.full_name;

// Set role text
const isAdmin = user.role === 'admin';
document.getElementById('sidebarRole').textContent = isAdmin ? 'Administrator' : 'Resident Dashboard';

// Populate sidebar menu based on role
const sidebarMenu = document.getElementById('sidebarMenu');
if (isAdmin) {
  sidebarMenu.innerHTML = `
    <li><a href="/admin">Manage Appointments</a></li>
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
      document.getElementById('full_name').value = userData.full_name || '';
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
    full_name: document.getElementById('full_name').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value
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
      user.full_name = formData.full_name;
      localStorage.setItem('user', JSON.stringify(user));
      showToast('✅ Profile updated successfully!', 'success');
      document.getElementById('userInfo').textContent = `Welcome, ${formData.full_name}`;
      document.getElementById('sidebarUserName').textContent = formData.full_name;
    } else {
      showToast(data.error || 'Update failed', 'error');
    }
  } catch (error) {
    showToast('An error occurred. Please try again.', 'error');
  }
});

// Change username
document.getElementById('usernameForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const messageDiv = document.getElementById('message');
  if (messageDiv) messageDiv.innerHTML = '';

  const newUsername = document.getElementById('new_username').value;

  const confirmed = await showConfirmModal(
    'Change Username',
    `Are you sure you want to change your username to "${newUsername}"?`
  );

  if (!confirmed) return;

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
});

// Send verification code for email change
document.getElementById('sendCodeBtn').addEventListener('click', async () => {
  const messageDiv = document.getElementById('message');
  if (messageDiv) messageDiv.innerHTML = '';
  
  const newEmail = document.getElementById('new_email').value;
  
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

  const code = document.getElementById('verification_code').value;
  const newEmail = document.getElementById('new_email').value;

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

// Load user data on page load
loadUserData();
