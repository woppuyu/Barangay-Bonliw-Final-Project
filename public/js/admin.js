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
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const [y, m, d] = value.split('-').map(Number);
          return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
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
    dateInput.value = apt.appointment_date;
    
    // Set min to today so past dates are greyed out
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    
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
for (let h=7; h<=16; h++) { // 7AM to 4:30PM
  HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:00:00`);
  HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:30:00`);
}

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

function renderWeeklyCalendar() {
  if (!weeklyCalendarEl) return;
  const filters = getAdminFilters();
  const is24 = localStorage.getItem('timeFormat') === '24';
  // Date-only boundaries to avoid timezone inconsistencies
  const weekStartISO = currentWeekStart.toISOString().split('T')[0];
  const weekEndISO = addDays(currentWeekStart,4).toISOString().split('T')[0]; // Monday-Friday
  const appointments = applyFilter((window.appointmentsList || []).map(a => {
    // Normalize date to YYYY-MM-DD
    const normDate = (typeof a.appointment_date === 'string') ? a.appointment_date.substring(0,10) : new Date(a.appointment_date).toISOString().split('T')[0];
    return { ...a, _date: normDate };
  }), filters).filter(a => a._date >= weekStartISO && a._date <= weekEndISO);

  // Build a map: key = date (YYYY-MM-DD) -> array of appointments
  const dayMap = {};
  for (let i=0;i<5;i++) { // Monday-Friday
    const d = addDays(currentWeekStart,i);
    const iso = d.toISOString().split('T')[0];
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

  // Day columns Monday-Friday
  for (let i=0;i<5;i++) {
    const d = addDays(currentWeekStart,i);
    const iso = d.toISOString().split('T')[0];
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
    // Place appointments for this day
    (dayMap[iso]||[]).forEach(a => {
      // Find position
      // Support appointment_time stored as 'HH:MM' or 'HH:MM:SS'
      const baseTime = a.appointment_time.substring(0,5); // HH:MM
      const slotIndex = HALF_HOUR_SLOTS.findIndex(s => s.startsWith(baseTime));
      if (slotIndex === -1) {
        // Debug: could not place appointment
        // console.debug('Calendar placement failed (admin):', a.appointment_time, 'base', baseTime);
        return;
      }
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
  return { service, status, date };
}

function applyFilter(list, { service, status, date }){
  return (list||[]).filter(a => {
    const okService = !service || (a.service_category === service);
    const okStatus = !status || (a.status === status);
    const apptDate = typeof a.appointment_date === 'string' ? a.appointment_date.substring(0,10) : new Date(a.appointment_date).toISOString().split('T')[0];
    const okDate = !date || (apptDate === date);
    return okService && okStatus && okDate;
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
