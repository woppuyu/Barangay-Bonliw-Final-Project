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

// Convert verbose backend text (with GMT timezone) to concise format similar to admin view
function formatResidentNotif(raw) {
  if (typeof raw !== 'string') return raw;
  // Patterns to handle:
  // "Status update: approved for appointment on Tue Nov 25 2025 00:00:00 GMT+0800 ... at 13:00:00"
  // "Reminder: Appointment at 16:00:00 on Fri Nov 21 2025 00:00:00 GMT+0800 ..."
  // Extract time and date pieces
  let statusMatch = raw.match(/Status update:\s*(\w+)\s*for appointment on ([A-Z][a-z]{2}) ([A-Z][a-z]{2}) (\d{1,2}) (\d{4}).*? at (\d{1,2}:\d{2}:\d{2})/);
  if (statusMatch) {
    const [, status, weekday, month, day, year, time] = statusMatch;
    const shortDate = `${month} ${day}, ${year}`;
    const shortTime = time.substring(0,5); // HH:MM
    return `<strong>Status:</strong> <span style='text-transform:uppercase;'>${status}</span> – ${shortDate} <span class='time-display'>${shortTime}</span>`;
  }
  let reminderMatch = raw.match(/Reminder:\s*Appointment at (\d{1,2}:\d{2}:\d{2}) on ([A-Z][a-z]{2}) ([A-Z][a-z]{2}) (\d{1,2}) (\d{4})/);
  if (reminderMatch) {
    const [ , time, weekday, month, day, year ] = reminderMatch;
    const shortDate = `${month} ${day}, ${year}`;
    const shortTime = time.substring(0,5);
    return `<strong>Reminder:</strong> ${shortDate} at <span class='time-display'>${shortTime}</span>`;
  }
  // Generic fallback: strip GMT clutter
  if (raw.includes('GMT')) {
    raw = raw.replace(/GMT[+\-]\d{4}.*?(?= at )/, '').replace(/GMT[+\-]\d{4}.*/,'');
  }
  // If still contains a time, wrap it
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
  loadAppointments(); // Reload appointments to update time display
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
  // Update active menu item
  if (bookAppointmentLink) bookAppointmentLink.classList.add('active');
  if (myAppointmentsLink) myAppointmentsLink.classList.remove('active');
}

function showMyAppointments() {
  bookAppointmentPanel.style.display = 'none';
  myAppointmentsPanel.style.display = 'block';
  closeSidebar();
  // Restore view preference when switching back to appointments
  restoreUserViewPreference();
  // Update active menu item
  if (myAppointmentsLink) myAppointmentsLink.classList.add('active');
  if (bookAppointmentLink) bookAppointmentLink.classList.remove('active');
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
  sessionStorage.clear(); // Clear view preferences
  window.location.href = '/';
});

// Load available time slots when date is selected
appointmentDateInput.addEventListener('change', async (e) => {
  const date = e.target.value;
  appointmentTimeSelect.innerHTML = '<option value="">Loading...</option>';

  // Only allow times between 07:00 and 16:30 (last slot at 4:30 PM)
  // If selected date is minDate, restrict times to those >= min hour
  let minHour = 7;
  let maxHour = 16; // Stop at 4:30 PM
  let allowedTimes = [];

  // If selected date is the min date, restrict times to those after minDate's hour
  const minDate = getMinBookingDateTime();
  const selectedDate = new Date(date + 'T00:00:00');
  if (formatDateYYYYMMDD(selectedDate) === formatDateYYYYMMDD(minDate)) {
    minHour = Math.max(minHour, minDate.getHours());
  }

  // Generate 30-minute interval slots from 7:00 AM to 4:30 PM
  for (let hour = minHour; hour <= maxHour; hour++) {
    allowedTimes.push((hour < 10 ? '0' : '') + hour + ':00');
    if (hour < maxHour || (hour === maxHour && maxHour === 16)) {
      allowedTimes.push((hour < 10 ? '0' : '') + hour + ':30');
    }
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
    window.myAppointmentsList = appointments; // cache for weekly calendar

    if (appointments.length === 0) {
      container.innerHTML = '<div class="empty-state"><p style="font-size: 15px;">No appointments yet. Book your first appointment above!</p></div>';
    } else {
      let html = '<div style="overflow-x: auto;"><table><thead><tr><th>Document Type</th><th>Date</th><th>Time</th><th>Status</th><th>Notes</th><th>Action</th></tr></thead><tbody>';
      
      appointments.forEach(apt => {
        html += `
          <tr>
            <td>${apt.document_type}</td>
            <td>${formatDate(apt.appointment_date)}</td>
            <td>${formatTime(apt.appointment_time)}</td>
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
      // Restore view preference if set
      restoreUserViewPreference();
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

// ================= Resident Weekly Calendar =================
const userWeekViewBtn = document.getElementById('userWeekViewBtn');
const userTableViewBtn = document.getElementById('userTableViewBtn');
const userWeeklyCalendarContainer = document.getElementById('userWeeklyCalendarContainer');
const userWeekNav = document.getElementById('userWeekNav');
const userPrevWeekBtn = document.getElementById('userPrevWeekBtn');
const userNextWeekBtn = document.getElementById('userNextWeekBtn');
const userThisWeekBtn = document.getElementById('userThisWeekBtn');
const userCalendarMonthLabel = document.getElementById('userCalendarMonthLabel');
const userWeeklyCalendarEl = document.getElementById('userWeeklyCalendar');
const userCalendarLegend = document.getElementById('userCalendarLegend');

let userCurrentWeekStart = startOfWeek(new Date());

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sunday
  const diff = (day === 0 ? -6 : 1) - day; // Monday start
  date.setDate(date.getDate() + diff);
  date.setHours(0,0,0,0);
  return date;
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

// Use 07:00 - 16:30 (30-minute slots) for resident clarity
const USER_HALF_HOUR_SLOTS = [];
for (let h=7; h<=16; h++) {
  USER_HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:00:00`);
  if (h < 16) {
    USER_HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:30:00`);
  } else if (h === 16) {
    USER_HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:30:00`); // Last slot at 4:30 PM
  }
}

function renderUserLegend() {
  userCalendarLegend.innerHTML = '';
  const statuses = [
    { key:'pending', label:'Pending', cls:'pending' },
    { key:'approved', label:'Approved', cls:'approved' },
    { key:'completed', label:'Completed', cls:'completed' }
  ];
  statuses.forEach(s => {
    const span = document.createElement('span');
    span.innerHTML = `<span class="legend-box ${s.cls}"></span>${s.label}`;
    userCalendarLegend.appendChild(span);
  });
}

function renderUserWeeklyCalendar() {
  if (!userWeeklyCalendarEl) return;
  const weekStartISO = userCurrentWeekStart.toISOString().split('T')[0];
  const weekEndISO = addDays(userCurrentWeekStart,4).toISOString().split('T')[0]; // Mon-Fri only
  const appointments = (window.myAppointmentsList || []).map(a => {
    const normDate = (typeof a.appointment_date === 'string') ? a.appointment_date.substring(0,10) : new Date(a.appointment_date).toISOString().split('T')[0];
    return { ...a, _date: normDate };
  }).filter(a => a._date >= weekStartISO && a._date <= weekEndISO);
  const dayMap = {};
  for (let i=0;i<5;i++) {
    const d = addDays(userCurrentWeekStart,i);
    const iso = d.toISOString().split('T')[0];
    dayMap[iso] = [];
  }
  appointments.forEach(a => { if (dayMap[a._date]) dayMap[a._date].push(a); });
  const monthYear = userCurrentWeekStart.toLocaleDateString(undefined,{ month:'long', year:'numeric' });
  userCalendarMonthLabel.textContent = monthYear;
  userWeeklyCalendarEl.innerHTML = '';
  const SLOT_HEIGHT = 40;
  const HEADER_HEIGHT = 50; // Fixed consistent height
  
  // Time column
  const timeCol = document.createElement('div');
  timeCol.className = 'time-column';
  const timeHeader = document.createElement('div');
  timeHeader.className = 'day-header';
  timeHeader.style.height = HEADER_HEIGHT + 'px';
  timeHeader.textContent = 'Time';
  timeCol.appendChild(timeHeader);
  USER_HALF_HOUR_SLOTS.forEach(t => {
    const label = document.createElement('div');
    label.className = 'time-slot-label';
    label.style.height = SLOT_HEIGHT + 'px';
    label.textContent = formatTime(t.substring(0,5));
    timeCol.appendChild(label);
  });
  userWeeklyCalendarEl.appendChild(timeCol);
  // Day columns
  for (let i=0;i<5;i++) {
    const d = addDays(userCurrentWeekStart,i);
    const iso = d.toISOString().split('T')[0];
    const dayCol = document.createElement('div');
    dayCol.className = 'day-column';
    const header = document.createElement('div');
    header.className = 'day-header';
    header.style.height = HEADER_HEIGHT + 'px';
    const dayStr = d.toLocaleDateString(undefined,{ weekday:'short' });
    header.innerHTML = `<span>${dayStr}</span> <strong>${d.getDate()}</strong>`;
    dayCol.appendChild(header);
    USER_HALF_HOUR_SLOTS.forEach(t => {
      const cell = document.createElement('div');
      cell.className = 'slot-cell';
      cell.style.height = SLOT_HEIGHT + 'px';
      cell.dataset.time = t;
      dayCol.appendChild(cell);
    });
    (dayMap[iso]||[]).forEach(a => {
      // Handle 'HH:MM' vs 'HH:MM:SS' by comparing prefix
      const baseTime = a.appointment_time.substring(0,5);
      const slotIndex = USER_HALF_HOUR_SLOTS.findIndex(s => s.startsWith(baseTime));
      if (slotIndex === -1) {
        // console.debug('Calendar placement failed (resident):', a.appointment_time, 'base', baseTime);
        return;
      }
      const durationSlots = 2; // 1 hour
      const block = document.createElement('div');
      block.className = `appointment-block ${a.status}`;
      const displayTime = formatTime(a.appointment_time.substring(0,5));
      block.innerHTML = `<div style='font-weight:600;'>${a.document_type}</div><div>${displayTime}</div><div style='font-size:10px;'>${a.status.toUpperCase()}</div>`;
      block.style.top = `${HEADER_HEIGHT + slotIndex * SLOT_HEIGHT + 1}px`;
      block.style.height = `${durationSlots * SLOT_HEIGHT - 4}px`;
      dayCol.appendChild(block);
    });
    userWeeklyCalendarEl.appendChild(dayCol);
  }
  renderUserLegend();
}

function restoreUserViewPreference() {
  const savedView = sessionStorage.getItem('userViewPreference');
  if (savedView === 'week') {
    userSwitchToWeekView();
  }
  // Default is table view, no action needed
}

function userSwitchToWeekView() {
  document.getElementById('appointmentsContainer').style.display = 'none';
  userWeeklyCalendarContainer.style.display = 'block';
  userWeekNav.hidden = false;
  if (userTableViewBtn && userWeekViewBtn) {
    userTableViewBtn.classList.remove('btn-primary');
    userTableViewBtn.classList.add('btn-secondary');
    userWeekViewBtn.classList.remove('btn-secondary');
    userWeekViewBtn.classList.add('btn-primary');
  }
  sessionStorage.setItem('userViewPreference', 'week');
  renderUserWeeklyCalendar();
}

function userSwitchToTableView() {
  userWeeklyCalendarContainer.style.display = 'none';
  document.getElementById('appointmentsContainer').style.display = 'block';
  userWeekNav.hidden = true;
  if (userTableViewBtn && userWeekViewBtn) {
    userWeekViewBtn.classList.remove('btn-primary');
    userWeekViewBtn.classList.add('btn-secondary');
    userTableViewBtn.classList.remove('btn-secondary');
    userTableViewBtn.classList.add('btn-primary');
  }
  sessionStorage.setItem('userViewPreference', 'table');
}

if (userWeekViewBtn) userWeekViewBtn.addEventListener('click', userSwitchToWeekView);
if (userTableViewBtn) userTableViewBtn.addEventListener('click', userSwitchToTableView);
if (userPrevWeekBtn) userPrevWeekBtn.addEventListener('click', () => { userCurrentWeekStart = addDays(userCurrentWeekStart, -7); renderUserWeeklyCalendar(); });
if (userNextWeekBtn) userNextWeekBtn.addEventListener('click', () => { userCurrentWeekStart = addDays(userCurrentWeekStart, 7); renderUserWeeklyCalendar(); });
if (userThisWeekBtn) userThisWeekBtn.addEventListener('click', () => { userCurrentWeekStart = startOfWeek(new Date()); renderUserWeeklyCalendar(); });

// Re-render calendar on time format change
window.addEventListener('timeFormatChanged', () => {
  if (userWeeklyCalendarContainer.style.display === 'block') renderUserWeeklyCalendar();
});
