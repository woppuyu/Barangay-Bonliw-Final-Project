const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database/db');
const { sendWelcomeEmail } = require('../services/email');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

// Register
router.post('/register', async (req, res) => {
  const { username, password, full_name, email, phone, address } = req.body;

  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'Please provide all required fields' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password, full_name, email, phone, address)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [username, hashedPassword, full_name, email, phone, address]
    );
    
    // Send welcome email if email is provided
    if (email) {
      sendWelcomeEmail(email, full_name).catch(err => 
        console.error('Failed to send welcome email:', err.message)
      );
    }
    
    res.json({ message: 'Registration successful', userId: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Please provide username and password' });
  }

  try {
    const { rows } = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Middleware to verify token
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(403).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  });
}

module.exports = router;
module.exports.verifyToken = verifyToken;
