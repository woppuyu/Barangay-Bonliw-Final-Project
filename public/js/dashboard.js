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
  return `${user.first_name} ${user.last_name}${mi ? ' ' + mi : ''}`;
}
document.getElementById('userInfo').textContent = `Welcome, ${formatUserName(user)}`;
document.getElementById('sidebarUserName').textContent = formatUserName(user);

// Burger menu toggle (define first)
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
      item.textContent = notif.text;
      notifDropdown.appendChild(item);
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

// Panel navigation (define after closeSidebar)
const bookAppointmentPanel = document.getElementById('bookAppointmentPanel');
const myAppointmentsPanel = document.getElementById('myAppointmentsPanel');
const bookAppointmentLink = document.getElementById('bookAppointmentLink');
const myAppointmentsLink = document.getElementById('myAppointmentsLink');
// --- Appointment Date/Time Restrictions ---
const appointmentDateInput = document.getElementById('appointment_date');
const appointmentTimeSelect = document.getElementById('appointment_time');

function getMinBookingDateTime() {
  const now = new Date();
  // Add 24 hours
  now.setHours(now.getHours() + 24);
  // Round up to next hour
  if (now.getMinutes() > 0 || now.getSeconds() > 0 || now.getMilliseconds() > 0) {
    now.setHours(now.getHours() + 1, 0, 0, 0);
  } else {
    now.setMinutes(0, 0, 0);
  }
  return now;
}

function formatDateYYYYMMDD(date) {
  return date.toISOString().split('T')[0];
}

// Set min date on load
if (appointmentDateInput) {
  const minDate = getMinBookingDateTime();
  appointmentDateInput.min = formatDateYYYYMMDD(minDate);
}

// --- Prepare for 12/24 hour toggle (placeholder) ---
// TODO: Add UI for toggling between 12/24 hour clock
// let use24HourClock = true; // For future implementation

// Friendly date formatter (avoids TZ shifts on YYYY-MM-DD)
function formatDate(value) {
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
  }
  const dt = new Date(value);
  return isNaN(dt) ? value : dt.toLocaleDateString(undefined, opts);
}

function showBookAppointment() {
  bookAppointmentPanel.style.display = 'block';
  myAppointmentsPanel.style.display = 'none';
  closeSidebar();
}

function showMyAppointments() {
  bookAppointmentPanel.style.display = 'none';
  myAppointmentsPanel.style.display = 'block';
  closeSidebar();
}

if (bookAppointmentLink) {
  bookAppointmentLink.addEventListener('click', (e) => {
    e.preventDefault();
    showBookAppointment();
  });
}

if (myAppointmentsLink) {
  myAppointmentsLink.addEventListener('click', (e) => {
    e.preventDefault();
    showMyAppointments();
  });
}

// Default view based on hash: #book to open booking panel
if (window.location.hash === '#book') {
  showBookAppointment();
} else {
  showMyAppointments();
}

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
});

// Load available time slots when date is selected
appointmentDateInput.addEventListener('change', async (e) => {
  const date = e.target.value;
  appointmentTimeSelect.innerHTML = '<option value="">Loading...</option>';

  // Only allow times between 08:00 and 17:00
  // If selected date is minDate, restrict times to those >= min hour
  let minHour = 8;
  let maxHour = 17;
  let allowedTimes = [];

  // If selected date is the min date, restrict times to those after minDate's hour
  const minDate = getMinBookingDateTime();
  const selectedDate = new Date(date + 'T00:00:00');
  if (formatDateYYYYMMDD(selectedDate) === formatDateYYYYMMDD(minDate)) {
    minHour = Math.max(minHour, minDate.getHours());
  }

  for (let hour = minHour; hour <= maxHour; hour++) {
    allowedTimes.push((hour < 10 ? '0' : '') + hour + ':00');
  }

  // Simulate fetching available slots (replace with backend filtering if needed)
  // For now, just show allowed times
  appointmentTimeSelect.innerHTML = '<option value="">Select Time</option>';
  allowedTimes.forEach(time => {
    const option = document.createElement('option');
    option.value = time;
    option.textContent = time; // TODO: Format for 12/24 hour toggle
    appointmentTimeSelect.appendChild(option);
  });
});

// Form validation helper
function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
}

function showFieldError(fieldId, message) {
  const errorDiv = document.getElementById(`error_${fieldId}`);
  if (errorDiv) {
    errorDiv.textContent = message;
  }
}

function validateForm() {
  clearFieldErrors();
  let isValid = true;

  const documentType = document.getElementById('document_type').value;
  const appointmentDate = document.getElementById('appointment_date').value;
  const appointmentTime = document.getElementById('appointment_time').value;

  if (!documentType) {
    showFieldError('document_type', 'Please select a document type');
    isValid = false;
  }

  if (!appointmentDate) {
    showFieldError('appointment_date', 'Please select an appointment date');
    isValid = false;
  }

  if (!appointmentTime) {
    showFieldError('appointment_time', 'Please select an appointment time');
    isValid = false;
  }

  return isValid;
}

// Handle appointment form submission
document.getElementById('appointmentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!validateForm()) {
    return;
  }
  
  const formData = {
    document_type: document.getElementById('document_type').value,
    purpose: document.getElementById('purpose').value,
    appointment_date: document.getElementById('appointment_date').value,
    appointment_time: document.getElementById('appointment_time').value
  };

  const messageDiv = document.getElementById('message');

  try {
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (response.ok) {
      showToast('Appointment booked successfully!', 'success');
      document.getElementById('appointmentForm').reset();
      loadAppointments();
      // Switch to My Appointments view after booking
      setTimeout(() => {
        showMyAppointments();
      }, 2000);
    } else {
      showToast(data.error || 'Failed to book appointment.', 'error');
    }
  } catch (error) {
    showToast('Failed to book appointment.', 'error');
    console.error('Error:', error);
  }
});

// Load user appointments
async function loadAppointments() {
  const container = document.getElementById('appointmentsContainer');

  try {
    const response = await fetch('/api/appointments/my-appointments', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const appointments = await response.json();

    if (appointments.length === 0) {
      container.innerHTML = '<div class="empty-state"><p style="font-size: 15px;">No appointments yet. Book your first appointment above!</p></div>';
    } else {
      let html = '<div style="overflow-x: auto;"><table><thead><tr><th>Document Type</th><th>Date</th><th>Time</th><th>Status</th><th>Notes</th><th>Action</th></tr></thead><tbody>';
      
      appointments.forEach(apt => {
        html += `
          <tr>
            <td>${apt.document_type}</td>
            <td>${formatDate(apt.appointment_date)}</td>
            <td>${apt.appointment_time}</td>
            <td><span class="status status-${apt.status}">${apt.status.toUpperCase()}</span></td>
            <td>${apt.notes || '-'}</td>
            <td>
              ${apt.status === 'pending' ? `<button class="btn btn-danger" onclick="deleteAppointment(${apt.id})">Cancel</button>` : '<span style="color: #a0aec0;">-</span>'}
            </td>
          </tr>
        `;
      });
      
      html += '</tbody></table></div>';
      container.innerHTML = html;
    }
  } catch (error) {
    container.innerHTML = '<div class="alert alert-error">Failed to load appointments.</div>';
    console.error('Error:', error);
  }
}

// Delete appointment
function deleteAppointment(id) {
  showConfirmModal(
    'Cancel Appointment',
    'Are you sure you want to cancel this appointment?',
    () => performCancelAppointment(id)
  );
}

async function performCancelAppointment(id) {
  try {
    const response = await fetch(`/api/appointments/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      showAlertModal('Success', 'Appointment cancelled successfully', 'success');
      loadAppointments();
    } else {
      showAlertModal('Error', data.error, 'error');
    }
  } catch (error) {
    showAlertModal('Error', 'Failed to cancel appointment', 'error');
    console.error('Error:', error);
  }
}

// Set minimum date to tomorrow
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
document.getElementById('appointment_date').min = tomorrow.toISOString().split('T')[0];

// Load appointments on page load
loadAppointments();
