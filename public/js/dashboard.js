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
  const servicesPanel = document.getElementById('servicesPanel');
  if (servicesPanel) servicesPanel.style.display = 'none';
  bookAppointmentPanel.style.display = 'block';
  myAppointmentsPanel.style.display = 'none';
  
  // Reset to step 1 and clear all data
  showBookingStep(1);
  
  closeSidebar();
  // Update active menu item
  const servicesLink = document.getElementById('servicesLink');
  if (servicesLink) servicesLink.classList.remove('active');
  if (bookAppointmentLink) bookAppointmentLink.classList.add('active');
  if (myAppointmentsLink) myAppointmentsLink.classList.remove('active');
}

function showMyAppointments() {
  const servicesPanel = document.getElementById('servicesPanel');
  if (servicesPanel) servicesPanel.style.display = 'none';
  bookAppointmentPanel.style.display = 'none';
  myAppointmentsPanel.style.display = 'block';
  closeSidebar();
  // Restore view preference when switching back to appointments
  restoreUserViewPreference();
  // Update active menu item
  const servicesLink = document.getElementById('servicesLink');
  if (servicesLink) servicesLink.classList.remove('active');
  if (myAppointmentsLink) myAppointmentsLink.classList.add('active');
  if (bookAppointmentLink) bookAppointmentLink.classList.remove('active');
}

function showServices() {
  const servicesPanel = document.getElementById('servicesPanel');
  if (servicesPanel) servicesPanel.style.display = 'block';
  bookAppointmentPanel.style.display = 'none';
  myAppointmentsPanel.style.display = 'none';
  closeSidebar();
  // Update active menu item
  const servicesLink = document.getElementById('servicesLink');
  if (servicesLink) servicesLink.classList.add('active');
  if (bookAppointmentLink) bookAppointmentLink.classList.remove('active');
  if (myAppointmentsLink) myAppointmentsLink.classList.remove('active');
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

const servicesLink = document.getElementById('servicesLink');
if (servicesLink) {
  servicesLink.addEventListener('click', (e) => {
    e.preventDefault();
    showServices();
  });
}

const goToBookingBtn = document.getElementById('goToBookingBtn');
if (goToBookingBtn) {
  goToBookingBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showBookAppointment();
  });
}

// Default view based on hash: #book to open booking panel
if (window.location.hash === '#book') {
  showBookAppointment();
} else if (window.location.hash === '#appointments') {
  showMyAppointments();
} else {
  // Default: show services panel
  showServices();
}

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.clear(); // Clear view preferences
  window.location.href = '/';
});

// Booking state management
let bookingData = {
  appointment_date: '',
  service_category: '',
  document_type: '',
  purpose: '',
  appointment_time: ''
};

// Step navigation functions
function showBookingStep(step) {
  // Hide all steps
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById(`bookingStep${i}`);
    if (stepEl) stepEl.style.display = 'none';
  }
  // Show current step
  const currentStep = document.getElementById(`bookingStep${step}`);
  if (currentStep) currentStep.style.display = 'block';
}

// Step 1: Date selection
const dateInput = document.getElementById('appointment_date_step1');
const nextToServiceBtn = document.getElementById('nextToServiceBtn');

if (dateInput && nextToServiceBtn) {
  // Set minimum date (2 days from now at 7 AM)
  const minDate = getMinBookingDateTime();
  dateInput.min = formatDateYYYYMMDD(minDate);
  
  nextToServiceBtn.addEventListener('click', () => {
    const errorDiv = document.getElementById('error_date_step1');
    if (!dateInput.value) {
      errorDiv.textContent = 'Please select a date';
      return;
    }
    errorDiv.textContent = '';
    bookingData.appointment_date = dateInput.value;
    
    // Display selected date in step 2
    const selectedDateDisplay = document.getElementById('selectedDateDisplay');
    if (selectedDateDisplay) {
      selectedDateDisplay.textContent = formatDate(bookingData.appointment_date);
    }
    
    showBookingStep(2);
  });
}

// Step 2: Service selection
const serviceRadios = document.querySelectorAll('input[name="service_category"]');
const nextToPurposeBtn = document.getElementById('nextToPurposeBtn');
const backToDateBtn = document.getElementById('backToDateBtn');

if (nextToPurposeBtn) {
  nextToPurposeBtn.addEventListener('click', () => {
    const errorDiv = document.getElementById('error_service_category');
    const selectedService = document.querySelector('input[name="service_category"]:checked');
    
    if (!selectedService) {
      errorDiv.textContent = 'Please select a service type';
      return;
    }
    errorDiv.textContent = '';
    bookingData.service_category = selectedService.value;
    
    // Display selected service in step 3
    const selectedServiceDisplay = document.getElementById('selectedServiceDisplay');
    const selectedDateDisplay2 = document.getElementById('selectedDateDisplay2');
    if (selectedServiceDisplay) {
      selectedServiceDisplay.textContent = bookingData.service_category;
    }
    if (selectedDateDisplay2) {
      selectedDateDisplay2.textContent = formatDate(bookingData.appointment_date);
    }
    
    // Show/hide document type field based on service
    const documentTypeGroup = document.getElementById('documentTypeGroup');
    const documentTypeSelect = document.getElementById('document_type');
    
    if (bookingData.service_category === 'Document Request') {
      documentTypeGroup.style.display = 'block';
      documentTypeSelect.setAttribute('required', 'required');
    } else {
      documentTypeGroup.style.display = 'none';
      documentTypeSelect.removeAttribute('required');
      bookingData.document_type = ''; // Clear if not needed
    }
    
    showBookingStep(3);
  });
}

if (backToDateBtn) {
  backToDateBtn.addEventListener('click', () => {
    showBookingStep(1);
  });
}

// Step 3: Purpose and details
const nextToTimeBtn = document.getElementById('nextToTimeBtn');
const backToServiceBtn = document.getElementById('backToServiceBtn');
const purposeInput = document.getElementById('purpose');
const documentTypeSelect = document.getElementById('document_type');

if (nextToTimeBtn) {
  nextToTimeBtn.addEventListener('click', async () => {
    // Validate purpose
    const errorPurpose = document.getElementById('error_purpose');
    const errorDocType = document.getElementById('error_document_type');
    
    let isValid = true;
    
    if (bookingData.service_category === 'Document Request') {
      if (!documentTypeSelect.value) {
        errorDocType.textContent = 'Please select a document type';
        isValid = false;
      } else {
        errorDocType.textContent = '';
        bookingData.document_type = documentTypeSelect.value;
      }
    }
    
    if (!purposeInput.value.trim()) {
      errorPurpose.textContent = 'Please provide purpose/details';
      isValid = false;
    } else {
      errorPurpose.textContent = '';
      bookingData.purpose = purposeInput.value.trim();
    }
    
    if (!isValid) return;
    
    // Display selected info in step 4
    const selectedDateDisplay3 = document.getElementById('selectedDateDisplay3');
    const selectedServiceDisplay2 = document.getElementById('selectedServiceDisplay2');
    if (selectedDateDisplay3) {
      selectedDateDisplay3.textContent = formatDate(bookingData.appointment_date);
    }
    if (selectedServiceDisplay2) {
      selectedServiceDisplay2.textContent = bookingData.service_category;
    }
    
    // Load available time slots
    await loadAvailableTimeSlots();
    
    showBookingStep(4);
  });
}

if (backToServiceBtn) {
  backToServiceBtn.addEventListener('click', () => {
    showBookingStep(2);
  });
}

// Step 4: Time selection and submission
const backToPurposeBtn = document.getElementById('backToPurposeBtn');
const submitAppointmentBtn = document.getElementById('submitAppointmentBtn');
const appointmentTimeSelect = document.getElementById('appointment_time');

if (backToPurposeBtn) {
  backToPurposeBtn.addEventListener('click', () => {
    showBookingStep(3);
  });
}

if (submitAppointmentBtn) {
  submitAppointmentBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const errorTime = document.getElementById('error_appointment_time');
    if (!appointmentTimeSelect.value) {
      errorTime.textContent = 'Please select a time slot';
      return;
    }
    errorTime.textContent = '';
    bookingData.appointment_time = appointmentTimeSelect.value;
    
    // Submit appointment
    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          service_category: bookingData.service_category,
          document_type: bookingData.document_type || null,
          purpose: bookingData.purpose,
          appointment_date: bookingData.appointment_date,
          appointment_time: bookingData.appointment_time
        })
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Appointment booked successfully!', 'success');
        
        // Reset booking data and form
        bookingData = {
          appointment_date: '',
          service_category: '',
          document_type: '',
          purpose: '',
          appointment_time: ''
        };
        
        if (dateInput) dateInput.value = '';
        serviceRadios.forEach(radio => radio.checked = false);
        if (documentTypeSelect) documentTypeSelect.value = '';
        if (purposeInput) purposeInput.value = '';
        if (appointmentTimeSelect) appointmentTimeSelect.innerHTML = '<option value="">Select a date first</option>';
        
        loadAppointments();
        fetchNotifications();
        
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
}

// Load available time slots for step 4
async function loadAvailableTimeSlots() {
  const date = bookingData.appointment_date;
  appointmentTimeSelect.innerHTML = '<option value="">Loading...</option>';

  // Only allow times between 07:00 and 16:30 (last slot at 4:30 PM)
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

  // Populate time select
  appointmentTimeSelect.innerHTML = '<option value="">Select Time</option>';
  allowedTimes.forEach(time => {
    const option = document.createElement('option');
    option.value = time;
    option.textContent = formatTime(time);
    appointmentTimeSelect.appendChild(option);
  });
}

// OLD CODE - Remove these as they're replaced by step-by-step logic
/*
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
      let html = '<div style="overflow-x: auto;"><table><thead><tr><th>Service Type</th><th>Details</th><th>Date</th><th>Time</th><th>Status</th><th>Notes</th><th>Action</th></tr></thead><tbody>';
      
      appointments.forEach(apt => {
        const serviceType = apt.service_category || 'N/A';
        const details = apt.document_type || apt.purpose || '-';
        
        html += `
          <tr>
            <td>${serviceType}</td>
            <td>${details}</td>
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
