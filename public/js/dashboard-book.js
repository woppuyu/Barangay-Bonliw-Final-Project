// Resident Book Appointment page script
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));
if (!token || !user) { window.location.href = '/#login'; }

if (user.role === 'resident') {
  fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` }})
    .then(res => res.json()).then(data => { if (!data.approved) window.location.href = '/pending-approval'; })
    .catch(() => {});
}

function formatUserName(user) { const mi = user.middle_name ? user.middle_name.charAt(0).toUpperCase() + '.' : ''; return `${user.first_name}${mi ? ' ' + mi : ''} ${user.last_name}`; }
document.getElementById('userInfo').textContent = `Welcome, ${formatUserName(user)}`;
document.getElementById('sidebarUserName').textContent = formatUserName(user);

// Sidebar
const burgerToggle=document.getElementById('burgerToggle'); const sidebarNav=document.getElementById('sidebarNav'); const sidebarOverlay=document.getElementById('sidebarOverlay');
function openSidebar(){ burgerToggle.classList.add('active'); sidebarNav.classList.add('active'); sidebarOverlay.classList.add('active'); document.body.style.overflow='hidden'; }
function closeSidebar(){ burgerToggle.classList.remove('active'); sidebarNav.classList.remove('active'); sidebarOverlay.classList.remove('active'); document.body.style.overflow=''; }
if (burgerToggle){ burgerToggle.addEventListener('click', ()=>{ if (sidebarNav.classList.contains('active')) closeSidebar(); else openSidebar(); }); }
if (sidebarOverlay){ sidebarOverlay.addEventListener('click', closeSidebar); }

// Notifications
const notifBell=document.getElementById('notifBell');const notifDropdown=document.getElementById('notifDropdown');const notifCount=document.getElementById('notifCount');
let notifications=[]; function renderNotifications(){ if(!notifDropdown) return; notifDropdown.innerHTML=''; if(notifications.length===0){ notifDropdown.innerHTML='<div class="notif-empty">No notifications</div>'; if(notifCount) notifCount.style.display='none'; } else { notifications.forEach(n=>{ const item=document.createElement('div'); item.className='notif-item'; item.innerHTML=n.text; notifDropdown.appendChild(item); }); if(notifCount){ notifCount.textContent=notifications.length; notifCount.style.display='inline-block'; } } }
if (notifBell){ notifBell.addEventListener('click', (e)=>{ e.stopPropagation(); notifDropdown.style.display = notifDropdown.style.display==='none'?'block':'none'; }); document.addEventListener('click', ()=>{ if(notifDropdown && notifDropdown.style.display==='block'){ notifDropdown.style.display='none'; } }); }
async function fetchNotifications(){ try { const r=await fetch('/api/notifications',{ headers:{ 'Authorization': `Bearer ${token}` } }); notifications = r.ok? await r.json(): []; } catch { notifications=[]; } renderNotifications(); }
fetchNotifications();

// Booking state
let bookingData = { appointment_date:'', service_category:'', document_type:'', purpose:'', appointment_time:'' };
function formatDateYYYYMMDD(date){ return date.toISOString().split('T')[0]; }
function getMinBookingDateTime(){ 
  const now=new Date(); 
  now.setHours(now.getHours()+24); 
  if (now.getMinutes()>0||now.getSeconds()>0||now.getMilliseconds()>0){ 
    now.setHours(now.getHours()+1,0,0,0);
  } else { 
    now.setMinutes(0,0,0);
  } 
  // Skip Sunday
  while (now.getDay() === 0) {
    now.setDate(now.getDate() + 1);
  }
  return now; 
}
function formatDate(value){ const opts={ year:'numeric', month:'short', day:'numeric' }; if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)){ const [y,m,d] = value.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString(undefined,opts); } const dt=new Date(value); return isNaN(dt)? value : dt.toLocaleDateString(undefined,opts); }
function formatTime(value){ const [hh,mm] = value.substring(0,5).split(':').map(Number); const is24 = localStorage.getItem('timeFormat')==='24'; if(is24) return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`; const suffix = hh>=12? 'PM':'AM'; const h12 = hh%12 || 12; return `${h12}:${String(mm).padStart(2,'0')} ${suffix}`; }

function showBookingStep(step){ for(let i=1;i<=4;i++){ const el=document.getElementById(`bookingStep${i}`); if(el) el.style.display='none'; } const cur=document.getElementById(`bookingStep${step}`); if(cur) cur.style.display='block'; }

// Step 1
const dateInput=document.getElementById('appointment_date_step1'); const nextToServiceBtn=document.getElementById('nextToServiceBtn');
if(dateInput){ 
  const minDate=getMinBookingDateTime(); 
  dateInput.min = formatDateYYYYMMDD(minDate); 
  // Disable Sundays - clear input if Sunday selected
  const validateSunday = (e) => {
    const selectedDate = new Date(e.target.value + 'T00:00:00');
    if (e.target.value && selectedDate.getDay() === 0) {
      e.target.value = '';
      showToast('Appointments cannot be scheduled on Sundays. Please select Monday-Saturday.', 'error');
      bookingData.appointment_date = '';
    }
  };
  dateInput.addEventListener('input', validateSunday);
  dateInput.addEventListener('change', validateSunday);
}
if(nextToServiceBtn){ nextToServiceBtn.addEventListener('click', ()=>{ 
  const err=document.getElementById('error_date_step1'); 
  if(!dateInput.value){ err.textContent='Please select a date'; return;} 
  // Check if selected date is Sunday
  const selectedDate = new Date(dateInput.value + 'T00:00:00');
  if (selectedDate.getDay() === 0) {
    err.textContent = 'Appointments cannot be scheduled on Sundays. Please select Monday-Saturday.';
    dateInput.value = '';
    return;
  }
  err.textContent=''; 
  bookingData.appointment_date=dateInput.value; 
  const disp=document.getElementById('selectedDateDisplay'); 
  if(disp) disp.textContent = formatDate(bookingData.appointment_date); 
  showBookingStep(2); 
}); }

// Step 2
const nextToPurposeBtn=document.getElementById('nextToPurposeBtn'); const backToDateBtn=document.getElementById('backToDateBtn');
if(nextToPurposeBtn){ nextToPurposeBtn.addEventListener('click', ()=>{ const err=document.getElementById('error_service_category'); const selected=document.querySelector('input[name="service_category"]:checked'); if(!selected){ err.textContent='Please select a service type'; return;} err.textContent=''; bookingData.service_category=selected.value; const dispSvc=document.getElementById('selectedServiceDisplay'); const dispDate2=document.getElementById('selectedDateDisplay2'); if(dispSvc) dispSvc.textContent=bookingData.service_category; if(dispDate2) dispDate2.textContent=formatDate(bookingData.appointment_date); const docGroup=document.getElementById('documentTypeGroup'); const docSelect=document.getElementById('document_type'); if(bookingData.service_category==='Document Request'){ docGroup.style.display='block'; docSelect.setAttribute('required','required'); } else { docGroup.style.display='none'; docSelect.removeAttribute('required'); bookingData.document_type=''; } showBookingStep(3); }); }
if(backToDateBtn){ backToDateBtn.addEventListener('click', ()=>{ showBookingStep(1); }); }

// Step 3
const nextToTimeBtn=document.getElementById('nextToTimeBtn'); const backToServiceBtn=document.getElementById('backToServiceBtn'); const purposeInput=document.getElementById('purpose'); const documentTypeSelect=document.getElementById('document_type');
if(nextToTimeBtn){ nextToTimeBtn.addEventListener('click', async ()=>{ const errPurpose=document.getElementById('error_purpose'); const errDoc=document.getElementById('error_document_type'); let ok=true; if(bookingData.service_category==='Document Request'){ if(!documentTypeSelect.value){ errDoc.textContent='Please select a document type'; ok=false; } else { errDoc.textContent=''; bookingData.document_type=documentTypeSelect.value; } }
  if(!purposeInput.value.trim()){ errPurpose.textContent='Please provide purpose/details'; ok=false; } else { errPurpose.textContent=''; bookingData.purpose=purposeInput.value.trim(); }
  if(!ok) return; const dispDate3=document.getElementById('selectedDateDisplay3'); const dispSvc2=document.getElementById('selectedServiceDisplay2'); if(dispDate3) dispDate3.textContent=formatDate(bookingData.appointment_date); if(dispSvc2) dispSvc2.textContent=bookingData.service_category; await loadAvailableTimeSlots(); showBookingStep(4); }); }
if(backToServiceBtn){ backToServiceBtn.addEventListener('click', ()=>{ showBookingStep(2); }); }

// Step 4
const backToPurposeBtn=document.getElementById('backToPurposeBtn'); const submitAppointmentBtn=document.getElementById('submitAppointmentBtn'); const appointmentTimeSelect=document.getElementById('appointment_time');
if(backToPurposeBtn){ backToPurposeBtn.addEventListener('click', ()=>{ showBookingStep(3); }); }
if(submitAppointmentBtn){ submitAppointmentBtn.addEventListener('click', async (e)=>{ e.preventDefault(); const errTime=document.getElementById('error_appointment_time'); if(!appointmentTimeSelect.value){ errTime.textContent='Please select a time slot'; return;} errTime.textContent=''; bookingData.appointment_time = appointmentTimeSelect.value; try { const response = await fetch('/api/appointments',{ method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ service_category: bookingData.service_category, document_type: bookingData.document_type || null, purpose: bookingData.purpose, appointment_date: bookingData.appointment_date, appointment_time: bookingData.appointment_time }) }); const data=await response.json(); if(response.ok){ showToast('Appointment booked successfully!','success'); // reset
 bookingData={ appointment_date:'', service_category:'', document_type:'', purpose:'', appointment_time:'' }; if(dateInput) dateInput.value=''; document.querySelectorAll('input[name="service_category"]').forEach(r=>r.checked=false); if(documentTypeSelect) documentTypeSelect.value=''; if(purposeInput) purposeInput.value=''; if(appointmentTimeSelect) appointmentTimeSelect.innerHTML = '<option value="">Select a date first</option>'; setTimeout(()=>{ window.location.href='/my-appointments'; }, 1500); } else { showToast(data.error||'Failed to book appointment.','error'); } } catch(err){ showToast('Failed to book appointment.','error'); } }); }

async function loadAvailableTimeSlots(){ const date=bookingData.appointment_date; appointmentTimeSelect.innerHTML='<option value="">Loading...</option>'; let minHour=7; let maxHour=16; const minDate=getMinBookingDateTime(); const selectedDate=new Date(date+'T00:00:00'); if(formatDateYYYYMMDD(selectedDate)===formatDateYYYYMMDD(minDate)){ minHour = Math.max(minHour, minDate.getHours()); }
  const times=[]; for(let h=minHour; h<=maxHour; h++){ times.push(`${String(h).padStart(2,'0')}:00`); if(h<maxHour || (h===maxHour && maxHour===16)){ times.push(`${String(h).padStart(2,'0')}:30`); } }
  appointmentTimeSelect.innerHTML='<option value="">Select Time</option>'; times.forEach(t=>{ const opt=document.createElement('option'); opt.value=t; opt.textContent=formatTime(t); appointmentTimeSelect.appendChild(opt); }); }

// Logout
const logoutBtn=document.getElementById('logoutBtn'); if(logoutBtn){ logoutBtn.addEventListener('click', ()=>{ localStorage.removeItem('token'); localStorage.removeItem('user'); sessionStorage.clear(); window.location.href='/'; }); }
