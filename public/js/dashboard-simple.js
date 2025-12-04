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

// Burger menu toggle
const burgerToggle = document.getElementById('burgerToggle');
const sidebarNav = document.getElementById('sidebarNav');
const sidebarOverlay = document.getElementById('sidebarOverlay');

// Notification Bell Logic
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
      item.innerHTML = formatResidentNotif(notif.text);
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

// Convert verbose backend text to concise format
function formatResidentNotif(raw) {
  if (typeof raw !== 'string') return raw;
  let statusMatch = raw.match(/Status update:\s*(\w+)\s*for appointment on ([A-Z][a-z]{2}) ([A-Z][a-z]{2}) (\d{1,2}) (\d{4}).*? at (\d{1,2}:\d{2}:\d{2})/);
  if (statusMatch) {
    const [, status, weekday, month, day, year, time] = statusMatch;
    const shortDate = `${month} ${day}, ${year}`;
    const shortTime = time.substring(0,5);
    return `<strong>Status:</strong> <span style='text-transform:uppercase;'>${status}</span> – ${shortDate} <span class='time-display'>${shortTime}</span>`;
  }
  let reminderMatch = raw.match(/Reminder:\s*Appointment at (\d{1,2}:\d{2}:\d{2}) on ([A-Z][a-z]{2}) ([A-Z][a-z]{2}) (\d{1,2}) (\d{4})/);
  if (reminderMatch) {
    const [ , time, weekday, month, day, year ] = reminderMatch;
    const shortDate = `${month} ${day}, ${year}`;
    const shortTime = time.substring(0,5);
    return `<strong>Reminder:</strong> ${shortDate} at <span class='time-display'>${shortTime}</span>`;
  }
  if (raw.includes('GMT')) {
    raw = raw.replace(/GMT[+\-]\d{4}.*?(?= at )/, '').replace(/GMT[+\-]\d{4}.*/,'');
  }
  let timeOnly = raw.match(/(\d{1,2}:\d{2})(?::\d{2})?(?![^<]*>)/);
  if (timeOnly) {
    raw = raw.replace(timeOnly[0], `<span class='time-display'>${timeOnly[1]}</span>`);
  }
  return raw;
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

function openSidebar() {
  burgerToggle.classList.add('active');
  sidebarNav.classList.add('active');
  sidebarOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  burgerToggle.classList.remove('active');
  sidebarNav.classList.remove('active');
  sidebarOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

if (burgerToggle) {
  burgerToggle.addEventListener('click', () => {
    if (sidebarNav.classList.contains('active')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener('click', closeSidebar);
}

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.clear();
  window.location.href = '/';
});
