// Resident My Appointments page script
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));
if (!token || !user) { window.location.href = '/#login'; }

// Approval check
if (user.role === 'resident') {
  fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` }})
    .then(res => res.json()).then(data => { if (!data.approved) window.location.href = '/pending-approval'; })
    .catch(() => {});
}

function formatUserName(user) {
  const mi = user.middle_name ? user.middle_name.charAt(0).toUpperCase() + '.' : '';
  return `${user.first_name}${mi ? ' ' + mi : ''} ${user.last_name}`;
}

document.getElementById('userInfo').textContent = `Welcome, ${formatUserName(user)}`;
document.getElementById('sidebarUserName').textContent = formatUserName(user);

// Sidebar toggle
const burgerToggle = document.getElementById('burgerToggle');
const sidebarNav = document.getElementById('sidebarNav');
const sidebarOverlay = document.getElementById('sidebarOverlay');
function openSidebar(){ burgerToggle.classList.add('active'); sidebarNav.classList.add('active'); sidebarOverlay.classList.add('active'); document.body.style.overflow='hidden'; }
function closeSidebar(){ burgerToggle.classList.remove('active'); sidebarNav.classList.remove('active'); sidebarOverlay.classList.remove('active'); document.body.style.overflow=''; }
if (burgerToggle){ burgerToggle.addEventListener('click', ()=>{ if (sidebarNav.classList.contains('active')) closeSidebar(); else openSidebar(); }); }
if (sidebarOverlay){ sidebarOverlay.addEventListener('click', closeSidebar); }

// Notifications
const notifBell=document.getElementById('notifBell');const notifDropdown=document.getElementById('notifDropdown');const notifCount=document.getElementById('notifCount');
let notifications=[];
function renderNotifications(){ if(!notifDropdown) return; notifDropdown.innerHTML=''; if(notifications.length===0){ notifDropdown.innerHTML='<div class="notif-empty">No notifications</div>'; if(notifCount) notifCount.style.display='none'; } else { notifications.forEach(n=>{ const item=document.createElement('div'); item.className='notif-item'; item.innerHTML=n.text; notifDropdown.appendChild(item); }); if(notifCount){ notifCount.textContent=notifications.length; notifCount.style.display='inline-block'; } } }
if (notifBell){ notifBell.addEventListener('click', (e)=>{ e.stopPropagation(); notifDropdown.style.display = notifDropdown.style.display==='none'?'block':'none'; }); document.addEventListener('click', ()=>{ if(notifDropdown && notifDropdown.style.display==='block'){ notifDropdown.style.display='none'; } }); }
async function fetchNotifications(){ try { const r=await fetch('/api/notifications',{ headers:{ 'Authorization': `Bearer ${token}` } }); notifications = r.ok? await r.json(): []; } catch { notifications=[]; } renderNotifications(); }
fetchNotifications();

// Logout
const logoutBtn=document.getElementById('logoutBtn'); if(logoutBtn){ logoutBtn.addEventListener('click', ()=>{ localStorage.removeItem('token'); localStorage.removeItem('user'); sessionStorage.clear(); window.location.href='/'; }); }

// Load appointments
async function loadAppointments(){ const container=document.getElementById('appointmentsContainer'); try { const r=await fetch('/api/appointments/my-appointments',{ headers:{ 'Authorization': `Bearer ${token}` } }); const appointments = await r.json(); window.myAppointmentsList = appointments; if(appointments.length===0){ container.innerHTML='<div class="empty-state"><p style="font-size: 15px;">No appointments yet.</p></div>'; } else { let html = '<div style="overflow-x:auto"><table><thead><tr><th>Service Type</th><th>Details</th><th>Date</th><th>Time</th><th>Status</th><th>Notes</th><th>Action</th></tr></thead><tbody>'; appointments.forEach(apt=>{ const serviceType = apt.service_category || 'Document Request'; const details = apt.document_type || apt.purpose || '-'; html += `<tr><td>${serviceType}</td><td>${details}</td><td>${formatDate(apt.appointment_date)}</td><td>${formatTime(apt.appointment_time)}</td><td><span class="status status-${apt.status}">${apt.status.toUpperCase()}</span></td><td>${apt.notes||'-'}</td><td>${apt.status==='pending' ? `<button class="btn btn-danger" onclick="deleteAppointment(${apt.id})">Cancel</button>` : '<span style="color:#a0aec0">-</span>'}</td></tr>`; }); html+='</tbody></table></div>'; container.innerHTML=html; } restoreViewPreference(); } catch(e){ container.innerHTML='<div class="alert alert-error">Failed to load appointments.</div>'; }}
loadAppointments();

function deleteAppointment(id){ showConfirmModal('Cancel Appointment','Are you sure you want to cancel this appointment?', ()=>performCancelAppointment(id)); }
async function performCancelAppointment(id){ try { const r=await fetch(`/api/appointments/${id}`,{ method:'DELETE', headers:{ 'Authorization': `Bearer ${token}` }}); const data=await r.json(); if(r.ok){ showToast('Appointment cancelled.','success'); loadAppointments(); } else { showToast(data.error||'Failed to cancel.','error'); } } catch(e){ showToast('Failed to cancel.','error'); } }

// Helpers
function formatDate(value){ const opts={ year:'numeric', month:'short', day:'numeric' }; if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)){ const [y,m,d] = value.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString(undefined,opts); } const dt=new Date(value); return isNaN(dt)? value : dt.toLocaleDateString(undefined,opts); }
function formatTime(value){ const [hh,mm] = value.substring(0,5).split(':').map(Number); const is24 = localStorage.getItem('timeFormat')==='24'; if(is24) return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`; const suffix = hh>=12? 'PM':'AM'; const h12 = hh%12 || 12; return `${h12}:${String(mm).padStart(2,'0')} ${suffix}`; }

// Calendar view functionality
const weeklyCalendarContainer = document.getElementById('weeklyCalendarContainer');
const weeklyCalendarEl = document.getElementById('weeklyCalendar');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const calendarLegend = document.getElementById('calendarLegend');
const tableViewBtn = document.getElementById('tableViewBtn');
const weekViewBtn = document.getElementById('weekViewBtn');
const prevWeekBtn = document.getElementById('prevWeekBtn');
const nextWeekBtn = document.getElementById('nextWeekBtn');
const thisWeekBtn = document.getElementById('thisWeekBtn');
const weekNav = document.getElementById('weekNav');

const USER_HALF_HOUR_SLOTS = [];
for (let h=7; h<=16; h++) { USER_HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:00:00`); if (h < 16) { USER_HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:30:00`); } else if (h === 16) { USER_HALF_HOUR_SLOTS.push(`${String(h).padStart(2,'0')}:30:00`); } }

function startOfWeek(date){ const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day===0?-6:1); d.setDate(diff); d.setHours(0,0,0,0); return d; }
function addDays(date, days){ const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy; }
// Helper to get local date string without timezone shifting
function toLocalISODate(d) {
  if (!(d instanceof Date)) return '';
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
}
let currentWeekStart = startOfWeek(new Date());

function renderLegend(){ if(!calendarLegend) return; calendarLegend.innerHTML=''; const statuses=[{key:'pending',label:'Pending',cls:'pending'},{key:'approved',label:'Approved',cls:'approved'},{key:'completed',label:'Completed',cls:'completed'}]; statuses.forEach(s=>{ const span=document.createElement('span'); span.innerHTML=`<span class="legend-box ${s.cls}"></span>${s.label}`; calendarLegend.appendChild(span); }); }

function renderWeeklyCalendar(){ if(!weeklyCalendarEl) return; const weekStartISO = toLocalISODate(currentWeekStart); const weekEndISO = toLocalISODate(addDays(currentWeekStart,5)); const appointments = (window.myAppointmentsList||[]).map(a=>{ const normDate = (typeof a.appointment_date==='string')? a.appointment_date.substring(0,10): toLocalISODate(new Date(a.appointment_date)); return {...a, _date:normDate}; }).filter(a=> a._date>=weekStartISO && a._date<=weekEndISO); const dayMap={}; for(let i=0;i<6;i++){ const d=addDays(currentWeekStart,i); const iso=toLocalISODate(d); dayMap[iso]=[]; } appointments.forEach(a=>{ if(dayMap[a._date]) dayMap[a._date].push(a); }); const monthYear = currentWeekStart.toLocaleDateString(undefined,{month:'long',year:'numeric'}); calendarMonthLabel.textContent=monthYear; weeklyCalendarEl.innerHTML=''; const SLOT_HEIGHT=40; const HEADER_HEIGHT=50; const timeCol=document.createElement('div'); timeCol.className='time-column'; const timeHeader=document.createElement('div'); timeHeader.className='day-header'; timeHeader.style.height=HEADER_HEIGHT+'px'; timeHeader.textContent='Time'; timeCol.appendChild(timeHeader); USER_HALF_HOUR_SLOTS.forEach(t=>{ const label=document.createElement('div'); label.className='time-slot-label'; label.style.height=SLOT_HEIGHT+'px'; label.textContent=formatTime(t.substring(0,5)); timeCol.appendChild(label); }); weeklyCalendarEl.appendChild(timeCol); for(let i=0;i<6;i++){ const d=addDays(currentWeekStart,i); const iso=toLocalISODate(d); const dayCol=document.createElement('div'); dayCol.className='day-column'; const header=document.createElement('div'); header.className='day-header'; header.style.height=HEADER_HEIGHT+'px'; const dayStr=d.toLocaleDateString(undefined,{weekday:'short'}); header.innerHTML=`<span>${dayStr}</span> <strong>${d.getDate()}</strong>`; dayCol.appendChild(header); USER_HALF_HOUR_SLOTS.forEach(t=>{ const cell=document.createElement('div'); cell.className='slot-cell'; cell.style.height=SLOT_HEIGHT+'px'; cell.dataset.time=t; dayCol.appendChild(cell); }); const statusPriority={'completed':1,'approved':2,'pending':3,'rejected':4}; const sortedAppointments=(dayMap[iso]||[]).sort((a,b)=>{ const timeCompare=a.appointment_time.localeCompare(b.appointment_time); if(timeCompare!==0) return timeCompare; return (statusPriority[a.status]||999)-(statusPriority[b.status]||999); }); const displayedSlots=new Set(); sortedAppointments.forEach(a=>{ const baseTime=a.appointment_time.substring(0,5); const slotIndex=USER_HALF_HOUR_SLOTS.findIndex(s=>s.startsWith(baseTime)); if(slotIndex===-1) return; if(displayedSlots.has(slotIndex)) return; displayedSlots.add(slotIndex); const durationSlots=1; const block=document.createElement('div'); block.className=`appointment-block ${a.status}`; const displayTime=formatTime(a.appointment_time.substring(0,5)); const serviceType = a.service_category || 'Document Request'; block.innerHTML=`<div style='font-weight:600;'>${serviceType}</div><div>${displayTime}</div><div style='font-size:10px;'>${a.status.toUpperCase()}</div>`; block.style.top=`${HEADER_HEIGHT+slotIndex*SLOT_HEIGHT+1}px`; block.style.height=`${durationSlots*SLOT_HEIGHT-4}px`; dayCol.appendChild(block); }); weeklyCalendarEl.appendChild(dayCol); } renderLegend(); }

function restoreViewPreference(){ const savedView=sessionStorage.getItem('userViewPreference'); if(savedView==='week'){ switchToWeekView(); } else { if(weekNav) weekNav.style.display='none'; } }

function switchToWeekView(){ document.getElementById('appointmentsContainer').style.display='none'; weeklyCalendarContainer.style.display='block'; if(weekNav) weekNav.style.display='flex'; if(tableViewBtn && weekViewBtn){ tableViewBtn.classList.remove('btn-primary'); tableViewBtn.classList.add('btn-secondary'); weekViewBtn.classList.remove('btn-secondary'); weekViewBtn.classList.add('btn-primary'); } sessionStorage.setItem('userViewPreference','week'); renderWeeklyCalendar(); }

function switchToTableView(){ weeklyCalendarContainer.style.display='none'; document.getElementById('appointmentsContainer').style.display='block'; if(weekNav) weekNav.style.display='none'; if(tableViewBtn && weekViewBtn){ weekViewBtn.classList.remove('btn-primary'); weekViewBtn.classList.add('btn-secondary'); tableViewBtn.classList.remove('btn-secondary'); tableViewBtn.classList.add('btn-primary'); } sessionStorage.setItem('userViewPreference','table'); }

if(weekViewBtn) weekViewBtn.addEventListener('click', switchToWeekView);
if(tableViewBtn) tableViewBtn.addEventListener('click', switchToTableView);
if(prevWeekBtn) prevWeekBtn.addEventListener('click', ()=>{ currentWeekStart=addDays(currentWeekStart,-7); renderWeeklyCalendar(); });
if(nextWeekBtn) nextWeekBtn.addEventListener('click', ()=>{ currentWeekStart=addDays(currentWeekStart,7); renderWeeklyCalendar(); });
if(thisWeekBtn) thisWeekBtn.addEventListener('click', ()=>{ currentWeekStart=startOfWeek(new Date()); renderWeeklyCalendar(); });

window.addEventListener('timeFormatChanged', ()=>{ if(weeklyCalendarContainer && weeklyCalendarContainer.style.display==='block') renderWeeklyCalendar(); });
