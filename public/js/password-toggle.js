(function(){
  function icon(show) {
    // Simple SVG eye / eye-off
    return show
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3l18 18" stroke="currentColor" stroke-width="2"/><path d="M10.58 5.08C11.04 5.03 11.51 5 12 5c7 0 11 7 11 7a19.2 19.2 0 0 1-5.13 5.71M6.13 8.29A19.17 19.17 0 0 0 1 12s4 7 11 7c1.26 0 2.45-.18 3.55-.5" stroke="currentColor" stroke-width="2"/></svg>'
  }

  function updateButton(btn, visible) {
    btn.setAttribute('aria-pressed', String(visible));
    btn.innerHTML = icon(visible);
    btn.title = visible ? 'Hide password' : 'Show password';
    btn.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  }

  function initToggle(btn) {
    const targetId = btn.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (!input) return;

    // Initial state
    updateButton(btn, false);

    btn.addEventListener('click', () => {
      const toShow = input.type === 'password';
      input.type = toShow ? 'text' : 'password';
      updateButton(btn, toShow);
    });
  }

  function initAll() {
    document.querySelectorAll('.toggle-password').forEach(initToggle);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();