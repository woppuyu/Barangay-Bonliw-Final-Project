// Check if user is logged in and is admin
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user || user.role !== 'admin') {
  window.location.href = '/#login';
}

// Display user info
function formatUserName(u) {
  const mi = u.middle_name ? u.middle_name.charAt(0).toUpperCase() + '.' : '';
  return `${u.first_name}${mi ? ' ' + mi : ''} ${u.last_name}`;
}
document.getElementById('userInfo').textContent = `Admin: ${formatUserName(user)}`;
document.getElementById('sidebarUserName').textContent = formatUserName(user);

// Burger menu toggle
const burgerToggle = document.getElementById('burgerToggle');
const sidebarNav = document.getElementById('sidebarNav');
const sidebarOverlay = document.getElementById('sidebarOverlay');

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
  sessionStorage.clear(); // Clear view preferences
  window.location.href = '/';
});

// Load all appointments
async function loadAppointments() {
  const container = document.getElementById('appointmentsContainer');

  try {
    const response = await fetch('/api/appointments/all', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const appointments = await response.json();
    
    // Ensure appointments are sorted by created_at descending (most recently booked first)
    appointments.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
      if (dateB - dateA !== 0) return dateB - dateA;
      return (b.id || 0) - (a.id || 0);
    });
    
    window.appointmentsList = appointments; // cache for rescheduling

    if (appointments.length === 0) {
      container.innerHTML = '<div class="empty-state"><p style="font-size: 15px;">No appointments in the system yet.</p></div>';
    } else {
      let html = '<div style="overflow-x: auto;"><table><thead><tr><th>Resident</th><th>Contact</th><th>Service Type</th><th>Details</th><th>Purpose</th><th>Date</th><th>Time</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead><tbody>';
      
      // Local formatter for dates
      const formatDate = (value) => {
        const opts = { year: 'numeric', month: 'short', day: 'numeric' };
        if (typeof value === 'string') {
          // Extract just the date part (first 10 chars) regardless of format
          const dateStr = value.substring(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
          }
        }
        const dt = new Date(value);
        return isNaN(dt) ? value : dt.toLocaleDateString(undefined, opts);
      };

      const filters = getAdminFilters();
      const filtered = applyFilter(appointments, filters);
      filtered.forEach(apt => {
        // Show delete button only for completed or rejected appointments
        const showDelete = apt.status === 'completed' || apt.status === 'rejected';
        
        const serviceType = apt.service_category || 'Document Request';
        const details = apt.document_type || '-';
        
        const safeNotes = (apt.notes || '').replace(/'/g, "\\'");
        html += `
          <tr>
            <td>${apt.first_name ? formatUserName(apt) : (apt.full_name || '-')}</td>
            <td>${apt.phone || apt.email || '-'}</td>
            <td>${serviceType}</td>
            <td>${details}</td>
            <td>${apt.purpose || '-'}</td>
            <td>${formatDate(apt.appointment_date)}</td>
            <td>${formatTime(apt.appointment_time)}</td>
            <td><span class="status status-${apt.status}">${apt.status.toUpperCase()}</span></td>
            <td>${apt.notes || '-'}</td>
            <td style="white-space: nowrap; display:flex; flex-direction:column; gap:4px;">
              <button class="btn btn-primary" onclick="openUpdateModal(${apt.id}, '${apt.status}', '${safeNotes}')">Update</button>
              ${showDelete ? `<button class="btn btn-danger" onclick="deleteAppointment(${apt.id})">Remove</button>` : ''}
            </td>
          </tr>
        `;
      });
      
      html += '</tbody></table></div>';
      container.innerHTML = html;
    }
    // Restore view preference if set
    restoreAdminViewPreference();
  } catch (error) {
    container.innerHTML = '<div class="alert alert-error">Failed to load appointments.</div>';
    console.error('Error:', error);
  }
}

// Helper function to disable Sundays in date inputs for admin
function disableSundaysInAdminDateInput(dateInput) {
  if (!dateInput) return;
  
  dateInput.addEventListener('input', (e) => {
    const selectedDate = new Date(e.target.value + 'T00:00:00');
    if (e.target.value && selectedDate.getDay() === 0) { // Sunday
      // Clear the input and show toast
      e.target.value = '';
      showToast('Cannot reschedule to Sunday. Office hours are Monday-Saturday.', 'error');
    }
  });
}

// Open update modal
function openUpdateModal(id, status, notes) {
  document.getElementById('appointmentId').value = id;
  document.getElementById('status').value = status;
  document.getElementById('notes').value = notes;
  const apt = (window.appointmentsList || []).find(a => a.id === id);
  const rescheduleWrapper = document.getElementById('rescheduleFields');
  if (apt && apt.status === 'pending') {
    rescheduleWrapper.style.display = 'block';
    const dateInput = document.getElementById('updateDate');
    const timeInput = document.getElementById('updateTime');
    dateInput.value = (apt.appointment_date || '').toString().substring(0,10);
    
    // Set min to today so past dates are greyed out (use local date format)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    dateInput.min = today;
    
    // Disable Sundays in date picker
    disableSundaysInAdminDateInput(dateInput);
    
    timeInput.value = apt.appointment_time;
  } else {
    rescheduleWrapper.style.display = 'none';
  }
  document.getElementById('updateModal').style.display = 'block';
}

// Close modal
function closeModal() {
  document.getElementById('updateModal').style.display = 'none';
}

// Handle update form submission
document.getElementById('updateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('appointmentId').value;
  const statusVal = document.getElementById('status').value;
  const notesVal = document.getElementById('notes').value;
  const apt = (window.appointmentsList || []).find(a => a.id == id);
  let dateChanged = false;
  let newDate, newTime;
  if (apt && apt.status === 'pending') {
    newDate = document.getElementById('updateDate').value || apt.appointment_date;
    newTime = document.getElementById('updateTime').value || apt.appointment_time;
    dateChanged = (newDate !== apt.appointment_date) || (newTime !== apt.appointment_time);
    if (dateChanged) {
      // Validate date is Monday-Saturday
      const selectedDate = new Date(newDate + 'T00:00:00');
      if (selectedDate.getDay() === 0) {
        showToast('Cannot reschedule to Sunday. Office hours are Monday-Saturday.', 'error');
        return;
      }
      // Validate time is between 7:00 and 16:30
      const [hours, minutes] = newTime.split(':').map(Number);
      if (hours < 7 || hours > 16 || (hours === 16 && minutes > 30)) {
        showToast('Appointment time must be between 7:00 AM and 4:30 PM.', 'error');
        return;
      }
      
      const originalDT = new Date(`${apt.appointment_date}T${apt.appointment_time}`);
      const newDT = new Date(`${newDate}T${newTime}`);
      if (isNaN(newDT.getTime())) {
        showToast('Invalid date/time.', 'error');
        return;
      }
      if (newDT < originalDT) {
        showToast('New date/time cannot be earlier than original.', 'error');
        return;
      }
      // Attempt reschedule first
      try {
        const resResp = await fetch(`/api/appointments/${id}/reschedule`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ appointment_date: newDate, appointment_time: newTime })
        });
        const resData = await resResp.json();
        if (!resResp.ok) {
          showToast(resData.error || 'Reschedule failed.', 'error');
          return;
        }
      } catch (err) {
        showToast('Reschedule request failed.', 'error');
        console.error(err);
        return;
      }
    }
  }

  // Status/notes update if changed
  const needStatusUpdate = !apt || apt.status !== statusVal || (apt.notes || '') !== notesVal;
  if (needStatusUpdate) {
    try {
      const response = await fetch(`/api/appointments/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: statusVal, notes: notesVal })
      });
      const data = await response.json();
      if (!response.ok) {
        showToast(data.error || 'Failed to update status.', 'error');
        return;
      }
    } catch (err) {
      showToast('Status update failed.', 'error');
      console.error(err);
      return;
    }
  }

  showToast(dateChanged || needStatusUpdate ? 'Appointment updated.' : 'No changes applied.', 'success');
  closeModal();
  loadAppointments();
});

// Delete appointment (admin only)
function deleteAppointment(id) {
  showConfirmModal(
    'Delete Appointment',
    'Are you sure you want to permanently remove this appointment? This action cannot be undone.',
    () => performDelete(id)
  );
}

async function performDelete(id) {
  const messageDiv = document.getElementById('message');

  try {
    const response = await fetch(`/api/appointments/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      showToast('Appointment removed successfully!', 'success');
      loadAppointments();
    } else {
      showToast(data.error || 'Failed to remove appointment.', 'error');
    }
  } catch (error) {
    showToast('Failed to remove appointment.', 'error');
    console.error('Error:', error);
  }
}

// --- Notification Bell Logic ---
const notifBell = document.getElementById('notifBell');
const notifDropdown = document.getElementById('notifDropdown');
const notifCount = document.getElementById('notifCount');

let notifications = [];

// --- Weekly Calendar Logic ---
const weekViewBtn = document.getElementById('weekViewBtn');
const tableViewBtn = document.getElementById('tableViewBtn');
const weeklyCalendarContainer = document.getElementById('weeklyCalendarContainer');
const appointmentsTableContainer = document.getElementById('appointmentsContainer');
const weekNav = document.getElementById('weekNav');
const prevWeekBtn = document.getElementById('prevWeekBtn');
const nextWeekBtn = document.getElementById('nextWeekBtn');
const thisWeekBtn = document.getElementById('thisWeekBtn');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const weeklyCalendarEl = document.getElementById('weeklyCalendar');
const calendarLegend = document.getElementById('calendarLegend');

let currentWeekStart = startOfWeek(new Date());

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sunday
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start
  date.setDate(date.getDate() + diff);
  date.setHours(0,0,0,0);
  return date;
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

const HALF_HOUR_SLOTS = [];
for (let h=7; h<16; h++) { // 7AM to 3:30PM
  HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:00:00`);
  HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:30:00`);
}
// Add final 4:00 PM and 4:30 PM slots
HALF_HOUR_SLOTS.push('16:00:00');
HALF_HOUR_SLOTS.push('16:30:00');

function renderLegend() {
  calendarLegend.innerHTML = '';
  const statuses = [
    { key:'approved', label:'Approved', cls:'approved' },
    { key:'pending', label:'Pending', cls:'pending' },
    { key:'completed', label:'Completed', cls:'completed' },
    { key:'rejected', label:'Rejected', cls:'rejected' }
  ];
  statuses.forEach(s => {
    const span = document.createElement('span');
    span.innerHTML = `<span class="legend-box ${s.cls}"></span>${s.label}`;
    calendarLegend.appendChild(span);
  });
}

function formatDayHeader(date) {
  const dayStr = date.toLocaleDateString(undefined,{ weekday:'short' });
  const numStr = date.getDate();
  return `${dayStr} ${numStr}`;
}

// Convert a Date to local YYYY-MM-DD without timezone shifting the calendar boundaries
const toLocalISODate = (d) => {
  if (!(d instanceof Date)) return '';
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
};

function renderWeeklyCalendar() {
  if (!weeklyCalendarEl) return;
  const filters = getAdminFilters();
  const is24 = localStorage.getItem('timeFormat') === '24';
  // Date-only boundaries - dates from database are already local YYYY-MM-DD format
  // Format: YYYY-MM-DD (no timezone conversion needed)
  const weekStartISO = `${currentWeekStart.getFullYear()}-${String(currentWeekStart.getMonth() + 1).padStart(2, '0')}-${String(currentWeekStart.getDate()).padStart(2, '0')}`;
  const weekEndDate = addDays(currentWeekStart, 5);
  const weekEndISO = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, '0')}-${String(weekEndDate.getDate()).padStart(2, '0')}`;
  const appointments = applyFilter((window.appointmentsList || []).map(a => {
    // Dates from database are already in YYYY-MM-DD local format, use directly
    const normDate = (typeof a.appointment_date === 'string') ? a.appointment_date.substring(0,10) : a.appointment_date;
    return { ...a, _date: normDate };
  }), filters).filter(a => a._date >= weekStartISO && a._date <= weekEndISO);

  // Build a map: key = date (YYYY-MM-DD) -> array of appointments
  const dayMap = {};
  for (let i=0;i<6;i++) { // Monday-Saturday
    const d = addDays(currentWeekStart,i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dayMap[iso] = [];
  }
  appointments.forEach(a => {
    if (dayMap[a._date]) dayMap[a._date].push(a);
  });

  // Month label: show Month Year of week start (if spans month maybe show both)
  const monthYear = currentWeekStart.toLocaleDateString(undefined,{ month:'long', year:'numeric' });
  calendarMonthLabel.textContent = monthYear;

  // Build grid
  weeklyCalendarEl.innerHTML = '';
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
  HALF_HOUR_SLOTS.forEach(t => {
    const label = document.createElement('div');
    label.className = 'time-slot-label';
    label.style.height = SLOT_HEIGHT + 'px';
    label.textContent = formatTime(t.substring(0,5));
    timeCol.appendChild(label);
  });
  weeklyCalendarEl.appendChild(timeCol);

  // Day columns Monday-Saturday
  for (let i=0;i<6;i++) {
    const d = addDays(currentWeekStart,i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayCol = document.createElement('div');
    dayCol.className = 'day-column';
    const header = document.createElement('div');
    header.className = 'day-header';
    header.style.height = HEADER_HEIGHT + 'px';
    const dayStr = d.toLocaleDateString(undefined,{ weekday:'short' });
    header.innerHTML = `<span>${dayStr}</span> <strong>${d.getDate()}</strong>`;
    dayCol.appendChild(header);
    HALF_HOUR_SLOTS.forEach(t => {
      const cell = document.createElement('div');
      cell.className = 'slot-cell';
      cell.style.height = SLOT_HEIGHT + 'px';
      cell.dataset.time = t;
      dayCol.appendChild(cell);
    });
    // Place appointments for this day with priority sorting
    // Priority: completed > approved > pending > rejected
    const statusPriority = { 'completed': 1, 'approved': 2, 'pending': 3, 'rejected': 4 };
    const sortedAppointments = (dayMap[iso]||[]).sort((a, b) => {
      const timeCompare = a.appointment_time.localeCompare(b.appointment_time);
      if (timeCompare !== 0) return timeCompare;
      return (statusPriority[a.status] || 999) - (statusPriority[b.status] || 999);
    });
    
    // Track which time slots already have appointments displayed
    const displayedSlots = new Set();
    
    sortedAppointments.forEach(a => {
      // Find position
      // Support appointment_time stored as 'HH:MM' or 'HH:MM:SS'
      const baseTime = a.appointment_time.substring(0,5); // HH:MM
      const slotIndex = HALF_HOUR_SLOTS.findIndex(s => s.startsWith(baseTime));
      if (slotIndex === -1) {
        // Debug: could not place appointment
        // console.debug('Calendar placement failed (admin):', a.appointment_time, 'base', baseTime);
        return;
      }
      
      // Skip if this time slot already has an appointment displayed (show only highest priority)
      if (displayedSlots.has(slotIndex)) {
        return;
      }
      displayedSlots.add(slotIndex);
      
      const durationSlots = 1; // default 30 minutes (1 half-hour slot)
      const block = document.createElement('div');
      block.className = `appointment-block ${a.status}`;
      const displayTime = formatTime(a.appointment_time.substring(0,5));
      const mi = a.middle_name ? a.middle_name.charAt(0).toUpperCase() + '.' : '';
      const userName = `${a.first_name}${mi ? ' ' + mi : ''} ${a.last_name}`;
      const serviceType = a.service_category || 'Document Request';
      block.innerHTML = `<div style='font-weight:600;'>${serviceType}</div><div>${displayTime}</div><div style='font-size:10px;'>${userName}</div>`;
      block.style.top = `${HEADER_HEIGHT + slotIndex * SLOT_HEIGHT + 1}px`;
      block.style.height = `${durationSlots * SLOT_HEIGHT - 4}px`;
      dayCol.appendChild(block);
    });
    weeklyCalendarEl.appendChild(dayCol);
  }
  renderLegend();
}

function restoreAdminViewPreference() {
  const savedView = sessionStorage.getItem('adminViewPreference');
  if (savedView === 'week') {
    switchToWeekView();
  } else {
    // Ensure week nav is hidden on initial load if in table view
    if (weekNav) weekNav.style.display = 'none';
  }
}

function switchToWeekView() {
  appointmentsTableContainer.style.display = 'none';
  weeklyCalendarContainer.style.display = 'block';
  if (weekNav) weekNav.style.display = 'flex';
  const filterToggleBtn = document.getElementById('filterToggleBtn');
  if (filterToggleBtn) filterToggleBtn.style.display = 'none';
  // Button active styling
  if (tableViewBtn && weekViewBtn) {
    tableViewBtn.classList.remove('btn-primary');
    tableViewBtn.classList.add('btn-secondary');
    weekViewBtn.classList.remove('btn-secondary');
    weekViewBtn.classList.add('btn-primary');
  }
  sessionStorage.setItem('adminViewPreference', 'week');
  renderWeeklyCalendar();
}

function switchToTableView() {
  weeklyCalendarContainer.style.display = 'none';
  appointmentsTableContainer.style.display = 'block';
  if (weekNav) weekNav.style.display = 'none';
  const filterToggleBtn = document.getElementById('filterToggleBtn');
  if (filterToggleBtn) filterToggleBtn.style.display = 'block';
  // Button active styling
  if (tableViewBtn && weekViewBtn) {
    weekViewBtn.classList.remove('btn-primary');
    weekViewBtn.classList.add('btn-secondary');
    tableViewBtn.classList.remove('btn-secondary');
    tableViewBtn.classList.add('btn-primary');
  }
  sessionStorage.setItem('adminViewPreference', 'table');
}

if (weekViewBtn) weekViewBtn.addEventListener('click', switchToWeekView);
if (tableViewBtn) tableViewBtn.addEventListener('click', switchToTableView);
if (prevWeekBtn) prevWeekBtn.addEventListener('click', () => { currentWeekStart = addDays(currentWeekStart, -7); renderWeeklyCalendar(); });
if (nextWeekBtn) nextWeekBtn.addEventListener('click', () => { currentWeekStart = addDays(currentWeekStart, 7); renderWeeklyCalendar(); });
if (thisWeekBtn) thisWeekBtn.addEventListener('click', () => { currentWeekStart = startOfWeek(new Date()); renderWeeklyCalendar(); });

// --- Filters ---
function getAdminFilters(){
  const service = document.getElementById('filterService')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const date = document.getElementById('filterDate')?.value || '';
  const month = document.getElementById('filterMonth')?.value || '';
  const year = document.getElementById('filterYear')?.value || '';
  return { service, status, date, month, year };
}

function applyFilter(list, { service, status, date, month, year }){
  return (list||[]).filter(a => {
    const okService = !service || (a.service_category === service);
    const okStatus = !status || (a.status === status);
    
    // Always compare on the stored date component (YYYY-MM-DD)
    let apptDate;
    if (typeof a.appointment_date === 'string') {
      apptDate = a.appointment_date.substring(0, 10);
    } else {
      // Convert to YYYY-MM-DD without timezone conversion
      const d = new Date(a.appointment_date);
      apptDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    
    // Extract year and month from appointment date (YYYY-MM-DD format)
    const [apptYear, apptMonth, apptDay] = apptDate.split('-');
    
    // Check if date matches (specific date filter)
    const okDate = !date || (apptDate === date);
    
    // Check if month matches (month/year filter)
    const okMonth = !month || (apptMonth === month);
    
    // Check if year matches (month/year filter)
    const okYear = !year || (apptYear === year);
    
    // If specific date is provided, use that; otherwise use month/year filters
    let okDateRange = true;
    if (date) {
      okDateRange = okDate;
    } else if (month || year) {
      okDateRange = okMonth && okYear;
    }
    
    if (date || month || year) {
      console.log(`Compare: apptDate="${apptDate}" vs filterDate="${date}", month="${month}", year="${year}", match=${okDateRange}`);
    }
    
    return okService && okStatus && okDateRange;
  });
}

// Re-render on filter changes
window.addEventListener('adminFiltersChanged', () => {
  // If in table view, rebuild table; if in week view, re-render calendar
  const isWeek = weeklyCalendarContainer && weeklyCalendarContainer.style.display === 'block';
  if (isWeek) {
    renderWeeklyCalendar();
  } else {
    loadAppointments();
  }
});


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
  loadAppointments(); // Reload appointments to update time display
  if (weeklyCalendarContainer.style.display === 'block') renderWeeklyCalendar();
});

// Load appointments on page load
loadAppointments();

// Removed separate reschedule logic; integrated into update modal
