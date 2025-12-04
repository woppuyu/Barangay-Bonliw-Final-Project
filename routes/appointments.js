const express = require('express');
const { pool } = require('../database/db');
const { verifyToken } = require('./auth');
const { sendAppointmentConfirmation, sendStatusUpdate } = require('../services/email');

const router = express.Router();

// Get available time slots
router.get('/time-slots', verifyToken, async (req, res) => {
  const { date } = req.query;
  try {
    const params = [];
    let query = `SELECT * FROM time_slots WHERE is_available = TRUE`;
    if (date) {
      query += ` AND date = $1`;
      params.push(date);
    }
    query += ` ORDER BY date, time`;
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch time slots' });
  }
});

// Create appointment (transactional)
router.post('/', verifyToken, async (req, res) => {
  const { service_category, document_type, purpose, appointment_date, appointment_time } = req.body;
  const user_id = req.userId;

  if (!service_category || !purpose || !appointment_date || !appointment_time) {
    return res.status(400).json({ error: 'Please provide all required fields' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // lock the slot row for update to avoid race conditions
    const { rows: slotRows } = await client.query(
      `SELECT * FROM time_slots WHERE date = $1 AND time = $2 AND is_available = TRUE FOR UPDATE`,
      [appointment_date, appointment_time]
    );
    if (slotRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Time slot not available' });
    }

    const { rows } = await client.query(
      `INSERT INTO appointments (user_id, service_category, document_type, purpose, appointment_date, appointment_time)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [user_id, service_category, document_type || null, purpose, appointment_date, appointment_time]
    );

    await client.query(
      `UPDATE time_slots SET is_available = FALSE WHERE date = $1 AND time = $2`,
      [appointment_date, appointment_time]
    );

    await client.query('COMMIT');
    
    // Get user details and send confirmation email
    const { rows: userRows } = await client.query(
      `SELECT first_name, last_name, middle_name, email FROM users WHERE id = $1`,
      [user_id]
    );
    const user = userRows[0];
    
    if (user && user.email) {
      const appointmentData = {
        service_category,
        document_type: document_type || 'N/A',
        purpose,
        appointment_date,
        appointment_time
      };
      const displayName = `${user.first_name}${user.middle_name ? ' ' + user.middle_name.charAt(0).toUpperCase() + '.' : ''} ${user.last_name}`;
      sendAppointmentConfirmation(user.email, displayName, appointmentData).catch(err =>
        console.error('Failed to send appointment confirmation:', err.message)
      );
    }
    
    res.json({ message: 'Appointment created successfully', appointmentId: rows[0].id });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Appointment creation error:', e);
    res.status(500).json({ error: 'Failed to create appointment' });
  } finally {
    client.release();
  }
});

// Get user's appointments
router.get('/my-appointments', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      // Show most recently booked first (use created_at if available, else id)
      `SELECT * FROM appointments WHERE user_id = $1 ORDER BY created_at DESC NULLS LAST, id DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get all appointments (admin only)
router.get('/all', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.first_name, u.last_name, u.middle_name, u.phone, u.email
       FROM appointments a
       JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC NULLS LAST, a.id DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Update appointment status (admin only)
router.put('/:id/status', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { id } = req.params;
  const { status, notes } = req.body;
  try {
    // Get current appointment with user details
    const { rows: currentRows } = await pool.query(
      `SELECT a.*, u.email, u.first_name, u.last_name, u.middle_name 
       FROM appointments a 
       JOIN users u ON a.user_id = u.id 
       WHERE a.id = $1`,
      [id]
    );
    
    if (currentRows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    const currentAppointment = currentRows[0];
    const oldStatus = currentAppointment.status;
    
    // Update the appointment
    const result = await pool.query(
      `UPDATE appointments SET status = $1, notes = $2 WHERE id = $3`,
      [status, notes || null, id]
    );
    
    if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });
    
    // Send email notification if status changed
    if (!currentAppointment.email) {
      console.log(`No email on file for user of appointment ${id}; skipping status email`);
    }
    if (currentAppointment.email && oldStatus !== status) {
      const appointmentData = {
        document_type: currentAppointment.document_type,
        appointment_date: currentAppointment.appointment_date,
        appointment_time: currentAppointment.appointment_time,
        notes: notes
      };
      console.log(`Sending status update email for appointment ${id}: ${oldStatus} -> ${status} to ${currentAppointment.email}`);
      const nameForStatus = `${currentAppointment.first_name}${currentAppointment.middle_name ? ' ' + currentAppointment.middle_name.charAt(0).toUpperCase() + '.' : ''} ${currentAppointment.last_name}`;
      sendStatusUpdate(
        currentAppointment.email,
        nameForStatus,
        appointmentData,
        oldStatus,
        status
      ).catch(err =>
        console.error('Failed to send status update email:', err.message)
      );
    }
    
    res.json({ message: 'Appointment updated successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Reschedule a pending appointment (admin only)
router.put('/:id/reschedule', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { id } = req.params;
  const { appointment_date: newDate, appointment_time: newTime } = req.body;

  if (!newDate || !newTime) {
    return res.status(400).json({ error: 'New date and time are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the appointment row
    const { rows: aptRows } = await client.query(
      'SELECT * FROM appointments WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (aptRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment not found' });
    }
    const apt = aptRows[0];
    if (apt.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only pending appointments can be rescheduled' });
    }

    const originalDateTime = new Date(`${apt.appointment_date}T${apt.appointment_time}`);
    const newDateTime = new Date(`${newDate}T${newTime}`);
    if (isNaN(newDateTime.getTime())) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid new date/time' });
    }
    if (newDateTime < originalDateTime) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'New date/time must be same or after original' });
    }

    // If unchanged, short-circuit
    if (apt.appointment_date === newDate && apt.appointment_time === newTime) {
      await client.query('ROLLBACK');
      return res.json({ message: 'No changes - appointment kept', appointment: apt });
    }

    // Ensure new slot available
    const { rows: newSlotRows } = await client.query(
      'SELECT * FROM time_slots WHERE date = $1 AND time = $2 AND is_available = TRUE FOR UPDATE',
      [newDate, newTime]
    );
    if (newSlotRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Desired new time slot is not available' });
    }

    // Free old slot
    await client.query(
      'UPDATE time_slots SET is_available = TRUE WHERE date = $1 AND time = $2',
      [apt.appointment_date, apt.appointment_time]
    );

    // Reserve new slot
    await client.query(
      'UPDATE time_slots SET is_available = FALSE WHERE date = $1 AND time = $2',
      [newDate, newTime]
    );

    // Update appointment
    await client.query(
      'UPDATE appointments SET appointment_date = $1, appointment_time = $2, updated_at = NOW() WHERE id = $3',
      [newDate, newTime, id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Appointment rescheduled successfully', appointment_id: apt.id, old: { date: apt.appointment_date, time: apt.appointment_time }, new: { date: newDate, time: newTime } });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to reschedule appointment' });
  } finally {
    client.release();
  }
});

// Delete appointment (and free slot)
router.delete('/:id', verifyToken, async (req, res) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid appointment ID' });
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if user is admin or the appointment owner
    let query, params;
    if (req.userRole === 'admin') {
      // Admin can delete any appointment
      query = `SELECT * FROM appointments WHERE id = $1 FOR UPDATE`;
      params = [id];
    } else {
      // Regular users can only delete their own appointments
      query = `SELECT * FROM appointments WHERE id = $1 AND user_id = $2 FOR UPDATE`;
      params = [id, req.userId];
    }
    
    const { rows: aptRows } = await client.query(query, params);
    
    if (aptRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment not found or access denied' });
    }

    const apt = aptRows[0];
    await client.query(`DELETE FROM appointments WHERE id = $1`, [id]);
    await client.query(
      `UPDATE time_slots SET is_available = TRUE WHERE date = $1 AND time = $2`,
      [apt.appointment_date, apt.appointment_time]
    );
    await client.query('COMMIT');
    res.json({ message: 'Appointment deleted successfully' });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to delete appointment' });
  } finally {
    client.release();
  }
});

module.exports = router;
