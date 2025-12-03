// Highlight active sidebar menu item based on current page
(function() {
  function setActiveMenuItem() {
    const currentPath = window.location.pathname;
    const menuLinks = document.querySelectorAll('.sidebar-menu a');
    
    menuLinks.forEach(link => {
      // Skip links with href="#" (internal navigation handled by page script)
      if (link.getAttribute('href') === '#') {
        return;
      }
      
      // Remove active class from all links first
      link.classList.remove('active');
      
      try {
        const linkPath = new URL(link.href).pathname;
        
        // Add active class to matching link
        if (linkPath === currentPath) {
          link.classList.add('active');
        }
        // Special handling for root path (/admin)
        else if (currentPath === '/admin' && linkPath === '/admin') {
          link.classList.add('active');
        }
      } catch (e) {
        // If URL parsing fails, try direct href comparison
        const href = link.getAttribute('href');
        if (href && href !== '#' && href === currentPath) {
          link.classList.add('active');
        }
      }
    });
  }
  
  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setActiveMenuItem);
  } else {
    setActiveMenuItem();
  }
})();
