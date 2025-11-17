const express = require('express');
const { pool } = require('../database/db');
const { verifyToken } = require('./auth');

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
  const { document_type, purpose, appointment_date, appointment_time } = req.body;
  const user_id = req.userId;

  if (!document_type || !appointment_date || !appointment_time) {
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
      `INSERT INTO appointments (user_id, document_type, purpose, appointment_date, appointment_time)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [user_id, document_type, purpose || null, appointment_date, appointment_time]
    );

    await client.query(
      `UPDATE time_slots SET is_available = FALSE WHERE date = $1 AND time = $2`,
      [appointment_date, appointment_time]
    );

    await client.query('COMMIT');
    res.json({ message: 'Appointment created successfully', appointmentId: rows[0].id });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to create appointment' });
  } finally {
    client.release();
  }
});

// Get user's appointments
router.get('/my-appointments', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM appointments WHERE user_id = $1 ORDER BY appointment_date DESC, appointment_time DESC`,
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
      `SELECT a.*, u.full_name, u.phone, u.email
       FROM appointments a
       JOIN users u ON a.user_id = u.id
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`
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
    const result = await pool.query(
      `UPDATE appointments SET status = $1, notes = $2 WHERE id = $3`,
      [status, notes || null, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ message: 'Appointment updated successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update appointment' });
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
