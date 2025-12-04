// Admin statistics page script
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user || user.role !== 'admin') {
  window.location.href = '/#login';
}

function formatUserName(u) {
  const mi = u.middle_name ? u.middle_name.charAt(0).toUpperCase() + '.' : '';
  return `${u.first_name}${mi ? ' ' + mi : ''} ${u.last_name}`;
}

document.getElementById('userInfo').textContent = `Admin: ${formatUserName(user)}`;

document.getElementById('sidebarUserName').textContent = formatUserName(user);

// View controls
const viewMonthBtn = document.getElementById('viewMonthBtn');
const viewYearBtn = document.getElementById('viewYearBtn');
const yearControls = document.getElementById('yearControls');
const monthControls = document.getElementById('monthControls');
const monthView = document.getElementById('monthView');
const yearView = document.getElementById('yearView');

// Year selectors
const statsYearSelect = document.getElementById('statsYear');
const monthYearSelect = document.getElementById('monthYear');
const monthSelect = document.getElementById('monthSelect');
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

for (let y = currentYear - 3; y <= currentYear + 1; y++) {
  const optY1 = document.createElement('option');
  optY1.value = y;
  optY1.textContent = y;
  if (y === currentYear) optY1.selected = true;
  statsYearSelect.appendChild(optY1);

  const optY2 = document.createElement('option');
  optY2.value = y;
  optY2.textContent = y;
  if (y === currentYear) optY2.selected = true;
  monthYearSelect.appendChild(optY2);
}

for (let m = 1; m <= 12; m++) {
  const optM = document.createElement('option');
  optM.value = m;
  optM.textContent = new Date(2000, m - 1, 1).toLocaleString(undefined, { month: 'short' });
  if (m === currentMonth) optM.selected = true;
  monthSelect.appendChild(optM);
}

statsYearSelect.addEventListener('change', () => loadYear(parseInt(statsYearSelect.value)));
monthYearSelect.addEventListener('change', () => loadMonthSummary(parseInt(monthYearSelect.value), parseInt(monthSelect.value)));
monthSelect.addEventListener('change', () => loadMonthSummary(parseInt(monthYearSelect.value), parseInt(monthSelect.value)));

function monthLabel(m) {
  return new Date(2000, m - 1, 1).toLocaleString(undefined, { month: 'short' });
}

function renderBarChart(container, data, labelKey = 'month') {
  container.innerHTML = '';
  const max = Math.max(...data.map(d => d.count), 1);
  const chart = document.createElement('div');
  chart.style.display = 'grid';
  chart.style.gridTemplateColumns = `repeat(${data.length}, 1fr)`;
  chart.style.gap = '8px';
  chart.style.alignItems = 'end';

  data.forEach(d => {
    const barWrap = document.createElement('div');
    barWrap.style.display = 'flex';
    barWrap.style.flexDirection = 'column';
    barWrap.style.alignItems = 'center';

    const bar = document.createElement('div');
    bar.style.height = `${Math.round((d.count / max) * 160)}px`;
    bar.style.width = '100%';
    bar.style.minWidth = '10px';
    bar.style.background = '#3182ce';
    bar.style.borderRadius = '6px 6px 0 0';

    const label = document.createElement('div');
    label.style.marginTop = '6px';
    label.style.fontSize = '12px';
    label.textContent = labelKey === 'month' ? monthLabel(d.month) : String(d.day);

    const value = document.createElement('div');
    value.style.fontSize = '11px';
    value.style.color = '#4a5568';
    value.textContent = d.count;
    value.style.marginTop = '4px';

    barWrap.appendChild(bar);
    barWrap.appendChild(label);
    barWrap.appendChild(value);

    chart.appendChild(barWrap);
  });

  container.appendChild(chart);
}

async function loadYear(year) {
  try {
    const res = await fetch(`/api/stats/monthly?year=${year}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch stats');
    const stats = await res.json();
    renderBarChart(document.getElementById('appointmentsYearChart'), stats.appointmentsByMonth, 'month');
    renderBarChart(document.getElementById('usersYearChart'), stats.usersByMonth, 'month');
  } catch (e) {
    showToast('Failed to load statistics', 'error');
    console.error(e);
  }
}

async function loadMonthSummary(year, month) {
  try {
    const res = await fetch(`/api/stats/month-summary?year=${year}&month=${month}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch month summary');
    const stats = await res.json();
    // Render pie + summary cards
    const pieEl = document.getElementById('appointmentsMonthPie');
    const appEl = document.getElementById('appointmentsMonthSummary');
    const userEl = document.getElementById('usersMonthSummary');
    pieEl.innerHTML = '';
    appEl.innerHTML = '';
    userEl.innerHTML = '';

    const totalCard = document.createElement('div');
    totalCard.className = 'stat-card';
    totalCard.innerHTML = `<div style="font-size:14px;color:#718096;">Total Appointments</div><div style="font-size:28px;font-weight:700;color:#2d3748;">${stats.totalAppointments}</div>`;
    appEl.appendChild(totalCard);

    const statuses = stats.appointmentsByStatus || {};
    const statusEntries = Object.keys(statuses).map(k => ({ status: k, count: statuses[k] }));
    statusEntries.forEach(s => {
      const c = document.createElement('div');
      c.className = 'stat-card';
      c.innerHTML = `<div style="font-size:14px;color:#718096;">${s.status.charAt(0).toUpperCase()+s.status.slice(1)}</div><div style="font-size:22px;font-weight:700;color:#2d3748;">${s.count}</div>`;
      appEl.appendChild(c);
    });

    // Draw pie chart of statuses
    renderPieChart(pieEl, statusEntries, (slice) => {
      // On slice click, load doc type breakdown
      loadDocTypeBreakdown(year, month, slice.status, slice.count);
    });

    const newUsersCard = document.createElement('div');
    newUsersCard.className = 'stat-card';
    newUsersCard.innerHTML = `<div style="font-size:14px;color:#718096;">New Users</div><div style="font-size:28px;font-weight:700;color:#2d3748;">${stats.newUsers}</div>`;
    userEl.appendChild(newUsersCard);
  } catch (e) {
    showToast('Failed to load month summary', 'error');
    console.error(e);
  }
}

function renderPieChart(container, data, onClick) {
  if (!data || data.length === 0) {
    container.innerHTML = '<div style="color:#718096;padding:40px;text-align:center;">No data available</div>';
    return;
  }
  
  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;
  const size = 240;
  const radius = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const svgNS = 'http://www.w3.org/2000/svg';
  
  // Clear container and set up proper layout
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.minHeight = `${size + 40}px`;
  container.style.display = 'flex';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'center';
  
  const chartWrapper = document.createElement('div');
  chartWrapper.style.position = 'relative';
  chartWrapper.style.width = `${size}px`;
  chartWrapper.style.height = `${size}px`;
  
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.style.display = 'block';

  const colors = ['#3182ce','#38a169','#d69e2e','#e53e3e','#805ad5','#dd6b20'];
  let startAngle = -Math.PI / 2;
  data.forEach((d, i) => {
    const fraction = d.count / total;
    const endAngle = startAngle + fraction * Math.PI * 2;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = fraction > 0.5 ? 1 : 0;
    const path = document.createElementNS(svgNS, 'path');
    const dPath = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    path.setAttribute('d', dPath);
    path.setAttribute('fill', colors[i % colors.length]);
    path.style.cursor = 'pointer';
    path.addEventListener('click', () => onClick && onClick(d));
    svg.appendChild(path);

    // Label
    const midAngle = (startAngle + endAngle) / 2;
    const lx = cx + (radius + 12) * Math.cos(midAngle);
    const ly = cy + (radius + 12) * Math.sin(midAngle);
    const label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.left = `${lx}px`;
    label.style.top = `${ly}px`;
    label.style.fontSize = '12px';
    label.style.color = '#4a5568';
    label.style.transform = 'translate(-50%, -50%)';
    label.style.whiteSpace = 'nowrap';
    label.textContent = `${d.status} (${d.count})`;
    chartWrapper.appendChild(label);

    startAngle = endAngle;
  });

  chartWrapper.appendChild(svg);
  container.appendChild(chartWrapper);
}

async function loadDocTypeBreakdown(year, month, status, count) {
  try {
    const res = await fetch(`/api/stats/month-doc-types?year=${year}&month=${month}&status=${encodeURIComponent(status)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch doc type breakdown');
    const data = await res.json();
    console.log('Breakdown data:', data);
    const panel = document.getElementById('docTypeBreakdown');
    const title = document.getElementById('breakdownTitle');
    const list = document.getElementById('docTypeList');
    const statusTitle = status.charAt(0).toUpperCase() + status.slice(1);
    title.textContent = `${statusTitle} - Breakdown (${count})`;
    list.innerHTML = '';
    data.breakdown.forEach(item => {
      console.log('Item:', item);
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      const serviceType = item.service_category || 'Other';
      row.innerHTML = `<span>${serviceType}</span><strong>${item.count}</strong>`;
      list.appendChild(row);
    });
    panel.style.display = 'block';
  } catch (e) {
    showToast('Failed to load document type breakdown', 'error');
    console.error(e);
  }
}

function setActive(btn) {
  [viewMonthBtn, viewYearBtn].forEach(b => {
    b.classList.toggle('btn-primary', b === btn);
    b.classList.toggle('btn-secondary', b !== btn);
  });
}

function switchToMonth() {
  monthView.style.display = 'block';
  yearView.style.display = 'none';
  yearControls.style.display = 'none';
  monthControls.style.display = 'flex';
  setActive(viewMonthBtn);
  loadMonthSummary(parseInt(monthYearSelect.value), parseInt(monthSelect.value));
}

function switchToYear() {
  monthView.style.display = 'none';
  yearView.style.display = 'block';
  yearControls.style.display = 'flex';
  monthControls.style.display = 'none';
  setActive(viewYearBtn);
  loadYear(parseInt(statsYearSelect.value));
}

viewMonthBtn.addEventListener('click', switchToMonth);
viewYearBtn.addEventListener('click', switchToYear);

// Initial load: show this month daily stats
switchToMonth();

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
  sessionStorage.clear();
  window.location.href = '/';
});

// Notification system
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
    notifications.forEach((notif) => {
      const item = document.createElement('div');
      item.className = 'notif-item';
      item.innerHTML = notif.text;
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
