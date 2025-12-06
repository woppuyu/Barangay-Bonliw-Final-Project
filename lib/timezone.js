/**
 * Timezone utilities for Philippine Time (+8 GMT)
 * Ensures consistent date handling across frontend and backend
 */

const PH_TIMEZONE_OFFSET = 8; // +8 hours

/**
 * Convert a date string (YYYY-MM-DD) to a JavaScript Date object
 * Treats the date as Philippine local time, not UTC
 * @param {string} dateStr - Date string in format YYYY-MM-DD
 * @returns {Date} JavaScript Date object representing PH midnight
 */
function dateStringToPhilippineDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create date assuming it's PH local time
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  return d;
}

/**
 * Convert a JavaScript Date to YYYY-MM-DD string using Philippine timezone
 * This ensures dates don't shift due to UTC conversion
 * @param {Date} date - JavaScript Date object
 * @returns {string} Date string in format YYYY-MM-DD
 */
function dateToPhilippineDateString(date) {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current date in Philippine timezone as YYYY-MM-DD
 * @returns {string} Today's date in Philippine timezone
 */
function getPhilippineToday() {
  return dateToPhilippineDateString(new Date());
}

/**
 * Get today's date at 00:00 PH time
 * @returns {Date} Today at midnight PH time
 */
function getPhilippineMidnightToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

/**
 * Check if a date string is today or in the future (Philippine timezone)
 * @param {string} dateStr - Date string in format YYYY-MM-DD
 * @returns {boolean} True if date is today or future
 */
function isDateTodayOrFuture(dateStr) {
  const targetDate = dateStringToPhilippineDate(dateStr);
  const today = getPhilippineMidnightToday();
  return targetDate >= today;
}

/**
 * Get minimum bookable date (tomorrow, 12:00 PM PH time)
 * @returns {Date} Tomorrow at 12:00 PM PH time
 */
function getMinBookingDateTime() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0);
  return tomorrow;
}

/**
 * Parse time string (HH:MM or HH:MM:SS) to hours and minutes
 * @param {string} timeStr - Time string
 * @returns {object} { hours, minutes }
 */
function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Validate time is within office hours (7:30 AM - 4:30 PM)
 * @param {string} timeStr - Time string in format HH:MM or HH:MM:SS
 * @returns {boolean} True if time is within office hours
 */
function isTimeWithinOfficeHours(timeStr) {
  const { hours, minutes } = parseTime(timeStr);
  
  // Check if before 7:30 AM
  if (hours < 7 || (hours === 7 && minutes < 30)) return false;
  
  // Check if after 4:30 PM (16:30)
  if (hours > 16 || (hours === 16 && minutes > 30)) return false;
  
  return true;
}

/**
 * Check if date is not Sunday (office open Mon-Sat)
 * @param {Date | string} dateInput - JavaScript Date or date string YYYY-MM-DD
 * @returns {boolean} True if office is open
 */
function isOfficeOpen(dateInput) {
  let date;
  if (typeof dateInput === 'string') {
    date = dateStringToPhilippineDate(dateInput);
  } else {
    date = dateInput;
  }
  return date.getDay() !== 0; // 0 = Sunday
}

module.exports = {
  PH_TIMEZONE_OFFSET,
  dateStringToPhilippineDate,
  dateToPhilippineDateString,
  getPhilippineToday,
  getPhilippineMidnightToday,
  isDateTodayOrFuture,
  getMinBookingDateTime,
  parseTime,
  isTimeWithinOfficeHours,
  isOfficeOpen
};
