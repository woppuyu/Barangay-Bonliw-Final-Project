// Site Settings - Dark Mode & Time Format Toggle
(function() {
  // Header settings button (for authenticated pages)
  const siteSettingsBtn = document.getElementById('siteSettingsBtn');
  const siteSettingsDropdown = document.getElementById('siteSettingsDropdown');
  
  // Floating settings button (for homepage)
  const floatingSiteSettingsBtn = document.getElementById('floatingSiteSettingsBtn');
  const floatingSiteSettingsDropdown = document.getElementById('floatingSiteSettingsDropdown');
  
  const darkModeToggle = document.getElementById('darkModeToggle');
  const timeFormatToggle = document.getElementById('timeFormatToggle');

  if (!darkModeToggle || !timeFormatToggle) return;

  // Load saved dark mode preference
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
    darkModeToggle.checked = true;
  }

  // Load saved time format preference (default: 12-hour)
  const is24Hour = localStorage.getItem('timeFormat') === '24';
  if (is24Hour) {
    timeFormatToggle.checked = true;
  }

  // Toggle dropdown functions
  function toggleHeaderSettingsDropdown() {
    if (!siteSettingsDropdown) return;
    const isVisible = siteSettingsDropdown.style.display === 'block';
    siteSettingsDropdown.style.display = isVisible ? 'none' : 'block';
  }

  function toggleFloatingSettingsDropdown() {
    if (!floatingSiteSettingsDropdown) return;
    const isVisible = floatingSiteSettingsDropdown.style.display === 'block';
    floatingSiteSettingsDropdown.style.display = isVisible ? 'none' : 'block';
  }

  // Header button click handler
  if (siteSettingsBtn) {
    siteSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHeaderSettingsDropdown();
    });
  }

  // Floating button click handler
  if (floatingSiteSettingsBtn) {
    floatingSiteSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFloatingSettingsDropdown();
    });
  }

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (siteSettingsDropdown && siteSettingsDropdown.style.display === 'block' && 
        !siteSettingsDropdown.contains(e.target) && 
        e.target !== siteSettingsBtn) {
      siteSettingsDropdown.style.display = 'none';
    }
    
    if (floatingSiteSettingsDropdown && floatingSiteSettingsDropdown.style.display === 'block' && 
        !floatingSiteSettingsDropdown.contains(e.target) && 
        e.target !== floatingSiteSettingsBtn) {
      floatingSiteSettingsDropdown.style.display = 'none';
    }
  });

  // Dark mode toggle
  darkModeToggle.addEventListener('change', () => {
    if (darkModeToggle.checked) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('darkMode', 'false');
    }
  });

  // Time format toggle
  timeFormatToggle.addEventListener('change', () => {
    if (timeFormatToggle.checked) {
      localStorage.setItem('timeFormat', '24');
    } else {
      localStorage.setItem('timeFormat', '12');
    }
    // Trigger a custom event so other scripts can update time displays
    window.dispatchEvent(new Event('timeFormatChanged'));
  });

  // Prevent dropdowns from closing when clicking inside
  if (siteSettingsDropdown) {
    siteSettingsDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  if (floatingSiteSettingsDropdown) {
    floatingSiteSettingsDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
})();
