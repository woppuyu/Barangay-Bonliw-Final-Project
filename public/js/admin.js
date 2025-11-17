// Check if user is logged in and is admin
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user || user.role !== 'admin') {
  window.location.href = '/login';
}

// Display user info
document.getElementById('userInfo').textContent = `Admin: ${user.full_name}`;

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
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

    if (appointments.length === 0) {
      container.innerHTML = '<div class="empty-state"><p style="font-size: 15px;">No appointments in the system yet.</p></div>';
    } else {
      let html = '<div style="overflow-x: auto;"><table><thead><tr><th>Resident</th><th>Contact</th><th>Document Type</th><th>Purpose</th><th>Date</th><th>Time</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead><tbody>';
      
      appointments.forEach(apt => {
        // Show delete button only for completed or rejected appointments
        const showDelete = apt.status === 'completed' || apt.status === 'rejected';
        
        html += `
          <tr>
            <td>${apt.full_name}</td>
            <td>${apt.phone || apt.email || '-'}</td>
            <td>${apt.document_type}</td>
            <td>${apt.purpose || '-'}</td>
            <td>${apt.appointment_date}</td>
            <td>${apt.appointment_time}</td>
            <td><span class="status status-${apt.status}">${apt.status.toUpperCase()}</span></td>
            <td>${apt.notes || '-'}</td>
            <td style="white-space: nowrap;">
              <button class="btn btn-primary" style="margin-bottom: 4px;" onclick="openUpdateModal(${apt.id}, '${apt.status}', '${(apt.notes || '').replace(/'/g, "\\'")}')">Update</button>
              ${showDelete ? `<button class="btn btn-danger" onclick="deleteAppointment(${apt.id})">Remove</button>` : ''}
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

// Open update modal
function openUpdateModal(id, status, notes) {
  document.getElementById('appointmentId').value = id;
  document.getElementById('status').value = status;
  document.getElementById('notes').value = notes;
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
  const formData = {
    status: document.getElementById('status').value,
    notes: document.getElementById('notes').value
  };

  const messageDiv = document.getElementById('message');

  try {
    const response = await fetch(`/api/appointments/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();

    if (response.ok) {
      messageDiv.innerHTML = '<div class="alert alert-success">Appointment updated successfully!</div>';
      closeModal();
      loadAppointments();
      setTimeout(() => {
        messageDiv.innerHTML = '';
      }, 3000);
    } else {
      messageDiv.innerHTML = `<div class="alert alert-error">${data.error}</div>`;
    }
  } catch (error) {
    messageDiv.innerHTML = '<div class="alert alert-error">Failed to update appointment.</div>';
    console.error('Error:', error);
  }
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
      messageDiv.innerHTML = '<div class="alert alert-success">Appointment removed successfully!</div>';
      loadAppointments();
      setTimeout(() => {
        messageDiv.innerHTML = '';
      }, 3000);
    } else {
      messageDiv.innerHTML = `<div class="alert alert-error">${data.error}</div>`;
      setTimeout(() => {
        messageDiv.innerHTML = '';
      }, 3000);
    }
  } catch (error) {
    messageDiv.innerHTML = '<div class="alert alert-error">Failed to remove appointment.</div>';
    console.error('Error:', error);
    setTimeout(() => {
      messageDiv.innerHTML = '';
    }, 3000);
  }
}

// Load appointments on page load
loadAppointments();
