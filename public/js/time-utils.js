// Time formatting utilities
window.formatTime = function(timeString) {
  const is24Hour = localStorage.getItem('timeFormat') === '24';
  
  if (is24Hour) {
    return timeString; // Return as-is (HH:MM format)
  }
  
  // Convert to 12-hour format
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};
