// Reusable Modal Utilities
// Include this script in any page that needs modals

// Show confirmation modal
function showConfirmModal(title, message, onConfirm) {
  let modal = document.getElementById('confirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="modalTitle"></h3>
        </div>
        <div class="modal-body">
          <p id="modalMessage"></p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" onclick="closeConfirmModal()">Cancel</button>
          <button class="btn btn-danger" id="modalConfirmBtn">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeConfirmModal();
      }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeConfirmModal();
      }
    });
  }

  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMessage').textContent = message;
  
  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.onclick = () => {
    closeConfirmModal();
    onConfirm();
  };

  modal.classList.add('active');
}

// Close confirmation modal
function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Show alert modal (replaces alert())
function showAlertModal(title, message, type = 'info') {
  let modal = document.getElementById('alertModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'alertModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="alertModalTitle"></h3>
        </div>
        <div class="modal-body">
          <p id="alertModalMessage"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="closeAlertModal()">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAlertModal();
      }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeAlertModal();
      }
    });
  }

  document.getElementById('alertModalTitle').textContent = title;
  document.getElementById('alertModalMessage').textContent = message;
  
  // Change button color based on type
  const okBtn = modal.querySelector('.modal-footer .btn');
  okBtn.className = 'btn';
  if (type === 'error') {
    okBtn.classList.add('btn-danger');
  } else if (type === 'success') {
    okBtn.classList.add('btn-success');
  } else {
    okBtn.classList.add('btn-primary');
  }

  modal.classList.add('active');
}

// Close alert modal
function closeAlertModal() {
  const modal = document.getElementById('alertModal');
  if (modal) {
    modal.classList.remove('active');
  }
}
