const express = require('express');
const { pool } = require('../database/db');
const { verifyToken } = require('./auth');

const router = express.Router();

// GET /api/stats/monthly?year=2025
// Returns counts of appointments and users grouped by month for the given year
router.get('/monthly', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const year = parseInt(req.query.year) || new Date().getFullYear();

  try {
    const { rows: aptRows } = await pool.query(
      `SELECT EXTRACT(MONTH FROM appointment_date) AS month, COUNT(*) AS count
       FROM appointments
       WHERE EXTRACT(YEAR FROM appointment_date) = $1
       GROUP BY month
       ORDER BY month`,
      [year]
    );

    const { rows: userRows } = await pool.query(
      `SELECT EXTRACT(MONTH FROM created_at) AS month, COUNT(*) AS count
       FROM users
       WHERE EXTRACT(YEAR FROM created_at) = $1
       GROUP BY month
       ORDER BY month`,
      [year]
    );

    // Normalize to 12 months
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const appointmentsByMonth = months.map(m => {
      const row = aptRows.find(r => parseInt(r.month) === m);
      return { month: m, count: row ? parseInt(row.count) : 0 };
    });
    const usersByMonth = months.map(m => {
      const row = userRows.find(r => parseInt(r.month) === m);
      return { month: m, count: row ? parseInt(row.count) : 0 };
    });

    res.json({ year, appointmentsByMonth, usersByMonth });
  } catch (err) {
    console.error('Monthly stats error:', err);
    res.status(500).json({ error: 'Failed to fetch monthly stats' });
  }
});

module.exports = router;

// GET /api/stats/daily?year=2025&month=11
// Returns counts of appointments and users grouped by day for the given month
router.get('/daily', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

  try {
    const { rows: aptRows } = await pool.query(
      `SELECT EXTRACT(DAY FROM appointment_date) AS day, COUNT(*) AS count
       FROM appointments
       WHERE EXTRACT(YEAR FROM appointment_date) = $1
         AND EXTRACT(MONTH FROM appointment_date) = $2
       GROUP BY day
       ORDER BY day`,
      [year, month]
    );

    const { rows: userRows } = await pool.query(
      `SELECT EXTRACT(DAY FROM created_at) AS day, COUNT(*) AS count
       FROM users
       WHERE EXTRACT(YEAR FROM created_at) = $1
         AND EXTRACT(MONTH FROM created_at) = $2
       GROUP BY day
       ORDER BY day`,
      [year, month]
    );

    // Determine days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const appointmentsByDay = days.map(d => {
      const row = aptRows.find(r => parseInt(r.day) === d);
      return { day: d, count: row ? parseInt(row.count) : 0 };
    });
    const usersByDay = days.map(d => {
      const row = userRows.find(r => parseInt(r.day) === d);
      return { day: d, count: row ? parseInt(row.count) : 0 };
    });

    res.json({ year, month, appointmentsByDay, usersByDay });
  } catch (err) {
    console.error('Daily stats error:', err);
    res.status(500).json({ error: 'Failed to fetch daily stats' });
  }
});

// GET /api/stats/month-summary?year=2025&month=11
// Returns aggregate statistics for a specific month
router.get('/month-summary', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

  try {
    const { rows: aptTotalRows } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM appointments
       WHERE EXTRACT(YEAR FROM appointment_date) = $1
         AND EXTRACT(MONTH FROM appointment_date) = $2`,
      [year, month]
    );

    const { rows: aptStatusRows } = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM appointments
       WHERE EXTRACT(YEAR FROM appointment_date) = $1
         AND EXTRACT(MONTH FROM appointment_date) = $2
       GROUP BY status`,
      [year, month]
    );

    const { rows: userRows } = await pool.query(
      `SELECT COUNT(*) AS count
       FROM users
       WHERE EXTRACT(YEAR FROM created_at) = $1
         AND EXTRACT(MONTH FROM created_at) = $2`,
      [year, month]
    );

    const totalAppointments = parseInt(aptTotalRows[0]?.count || 0);
    const appointmentsByStatus = aptStatusRows.reduce((acc, r) => {
      acc[r.status] = parseInt(r.count);
      return acc;
    }, {});
    const newUsers = parseInt(userRows[0]?.count || 0);

    res.json({ year, month, totalAppointments, newUsers, appointmentsByStatus });
  } catch (err) {
    console.error('Month summary stats error:', err);
    res.status(500).json({ error: 'Failed to fetch month summary stats' });
  }
});

// GET /api/stats/month-doc-types?year=2025&month=11&status=approved
// Returns document_type distribution for given month filtered by status (optional)
router.get('/month-doc-types', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
  const status = req.query.status || null;

  try {
    const params = [year, month];
    let query = `SELECT document_type, COUNT(*) AS count
                 FROM appointments
                 WHERE EXTRACT(YEAR FROM appointment_date) = $1
                   AND EXTRACT(MONTH FROM appointment_date) = $2`;
    if (status) {
      params.push(status);
      query += ` AND status = $3`;
    }
    query += ` GROUP BY document_type ORDER BY count DESC`;

    const { rows } = await pool.query(query, params);
    const breakdown = rows.map(r => ({ document_type: r.document_type, count: parseInt(r.count) }));
    res.json({ year, month, status: status || 'all', breakdown });
  } catch (err) {
    console.error('Month doc types error:', err);
    res.status(500).json({ error: 'Failed to fetch document type breakdown' });
  }
});
