// Lightweight toast notifications
(function() {
  const DEFAULT_DURATION = 3000;
  const TYPES = {
    success: { bg: '#2f855a', text: '#ffffff' },
    error: { bg: '#c53030', text: '#ffffff' },
    info: { bg: '#2c5282', text: '#ffffff' }
  };

  function ensureContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type = 'info', duration = DEFAULT_DURATION) {
    const container = ensureContainer();
    const cfg = TYPES[type] || TYPES.info;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.background = cfg.bg;
    toast.style.color = cfg.text;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));

    const hide = () => {
      toast.classList.remove('show');
      toast.classList.add('hide');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      }, { once: true });
    };

    // Auto dismiss
    const t = setTimeout(hide, Math.max(1200, duration));

    // Manual dismiss on click
    toast.addEventListener('click', () => {
      clearTimeout(t);
      hide();
    });
  }

  // Expose globally
  window.showToast = showToast;
})();
