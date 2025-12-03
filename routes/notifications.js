const express = require('express');
const router = express.Router();
const { pool } = require('../database/db');
const { authenticateToken } = require('./auth');

// Get notifications for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    let notifications = [];

    if (role === 'admin') {
      // Admin: show new user registrations and new appointments
      const newUsers = await pool.query('SELECT id, first_name, last_name, middle_name, created_at FROM users WHERE approved = false ORDER BY created_at DESC LIMIT 10');
      const newAppointments = await pool.query('SELECT appointments.id, users.first_name, users.last_name, users.middle_name, appointments.appointment_date, appointments.appointment_time FROM appointments JOIN users ON appointments.user_id = users.id WHERE appointments.status = $1 ORDER BY appointments.created_at DESC LIMIT 10', ['pending']);
      notifications = [
        ...newUsers.rows.map(u => {
          const mi = u.middle_name ? u.middle_name.charAt(0).toUpperCase() + '.' : '';
          return { type: 'user', text: `New user registered: ${u.first_name}${mi ? ' ' + mi : ''} ${u.last_name}` };
        }),
        ...newAppointments.rows.map(a => {
          const mi = a.middle_name ? a.middle_name.charAt(0).toUpperCase() + '.' : '';
          const name = `${a.first_name} ${a.last_name}${mi ? ' ' + mi : ''}`;
          // Format date as "Mon Nov 21"
          const date = new Date(a.appointment_date);
          const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          // Return time in 24-hour format; client will format based on preference
          return { type: 'appointment', text: `New appointment: <strong>${name}</strong> on ${dateStr} at <span class="time-display">${a.appointment_time}</span>` };
        })
      ];
    } else {
      // Resident: show status updates and reminders for their appointments
      const statusUpdates = await pool.query('SELECT id, status, appointment_date, appointment_time FROM appointments WHERE user_id = $1 AND status != $2 ORDER BY updated_at DESC LIMIT 10', [userId, 'pending']);
      const upcoming = await pool.query('SELECT id, appointment_date, appointment_time FROM appointments WHERE user_id = $1 AND status = $2 AND appointment_date >= CURRENT_DATE ORDER BY appointment_date, appointment_time LIMIT 1', [userId, 'approved']);
      notifications = [
        ...statusUpdates.rows.map(a => ({ type: 'status', text: `Status update: ${a.status} for appointment on ${a.appointment_date} at ${a.appointment_time}` })),
      ];
      if (upcoming.rows.length > 0) {
        notifications.push({ type: 'reminder', text: `Reminder: Appointment at ${upcoming.rows[0].appointment_time} on ${upcoming.rows[0].appointment_date}` });
      }
    }
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

module.exports = router;
