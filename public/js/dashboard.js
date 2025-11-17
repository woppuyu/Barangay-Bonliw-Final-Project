// Check if user is logged in
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
  window.location.href = '/login';
}

// Display user info
document.getElementById('userInfo').textContent = `Welcome, ${user.full_name}`;

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
});

// Load available time slots when date is selected
document.getElementById('appointment_date').addEventListener('change', async (e) => {
  const date = e.target.value;
  const timeSelect = document.getElementById('appointment_time');
  
  timeSelect.innerHTML = '<option value="">Loading...</option>';

  try {
    const response = await fetch(`/api/appointments/time-slots?date=${date}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const slots = await response.json();

    if (slots.length === 0) {
      timeSelect.innerHTML = '<option value="">No available slots</option>';
    } else {
      timeSelect.innerHTML = '<option value="">Select Time</option>';
      slots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot.time;
        option.textContent = slot.time;
        timeSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading time slots:', error);
    timeSelect.innerHTML = '<option value="">Error loading slots</option>';
  }
});

// Handle appointment form submission
document.getElementById('appointmentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
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
      messageDiv.innerHTML = '<div class="alert alert-success">Appointment booked successfully!</div>';
      document.getElementById('appointmentForm').reset();
      loadAppointments();
    } else {
      messageDiv.innerHTML = `<div class="alert alert-error">${data.error}</div>`;
    }
  } catch (error) {
    messageDiv.innerHTML = '<div class="alert alert-error">Failed to book appointment.</div>';
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
            <td>${apt.appointment_date}</td>
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
