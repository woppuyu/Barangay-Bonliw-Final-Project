const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database/db');
const { sendWelcomeEmail, sendVerificationCode } = require('../services/email');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const REG_TOKEN_SECRET = process.env.REG_TOKEN_SECRET || (JWT_SECRET + '-reg');

// Generate random 6-digit code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Register

router.post('/register', async (req, res) => {
  const { username, password, first_name, last_name, middle_name, email, phone, address } = req.body;

  if (!username || !password || !first_name || !last_name) {
    return res.status(400).json({ error: 'Please provide all required fields' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Normalize phone if provided
    let normalizedPhone = null;
    if (phone) {
      normalizedPhone = normalizePHPhone(phone);
      if (!normalizedPhone) {
        return res.status(400).json({ error: 'Enter a valid PH phone number (+63 or 09)' });
      }
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password, first_name, last_name, middle_name, email, phone, address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [username, hashedPassword, first_name, last_name, middle_name, email, normalizedPhone, address]
    );

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
    // Distinguish non-existent account from bad password
    if (!user) return res.status(404).json({ error: 'Account not found' });

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
        first_name: user.first_name,
        last_name: user.last_name,
        middle_name: user.middle_name,
        role: user.role,
        approved: user.approved
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Helpers for registration contact validation
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePHPhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[^0-9+]/g, '');
  // +63XXXXXXXXXX
  if (/^\+63\d{10}$/.test(cleaned)) return cleaned;
  // 09XXXXXXXXX -> +63XXXXXXXXXX
  if (/^0\d{10}$/.test(cleaned)) return `+63${cleaned.slice(1)}`;
  return null;
}

function isValidPHPhone(phone) {
  return normalizePHPhone(phone) !== null;
}

// Step 1: Initiate registration (for email verification flow)
router.post('/register-initiate', async (req, res) => {
  const { username, password, first_name, last_name, middle_name, contact, address } = req.body;

  if (!username || !password || !first_name || !last_name || !contact) {
    return res.status(400).json({ error: 'Please provide all required fields' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Ensure username not taken
    // Consolidated uniqueness check
    const existing = await pool.query('SELECT 1 FROM users WHERE username = $1 OR email = $2', [username, contact]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    if (isValidEmail(contact)) {
      const code = generateVerificationCode();
      // Send email code
      await sendVerificationCode(contact, `${first_name} ${last_name}${middle_name ? ' ' + middle_name.charAt(0).toUpperCase() + '.' : ''}`, code);

      // Build short-lived registration token including hashed password
      const passwordHash = bcrypt.hashSync(password, 10);
      const regToken = jwt.sign(
        { step: 'registration', username, first_name, last_name, middle_name, email: contact, phone: null, address: address || null, passwordHash, code },
        REG_TOKEN_SECRET,
        { expiresIn: '10m' }
      );

      return res.json({ requires_verification: true, regToken, message: 'Verification code sent to email' });
    }

    if (isValidPHPhone(contact)) {
      // Phone path does not require email verification; client should call /register directly
      return res.json({ requires_verification: false, message: 'Phone number is valid. Proceed with registration.' });
    }

    return res.status(400).json({ error: 'Enter a valid email or PH phone (+63 or 09)' });
  } catch (err) {
    console.error('Register initiate error:', err);
    return res.status(500).json({ error: 'Failed to initiate registration' });
  }
});

// Step 2: Complete registration after verifying email code
router.post('/register-complete', async (req, res) => {
  const { regToken, code } = req.body;
  if (!regToken || !code) {
    return res.status(400).json({ error: 'Verification is required' });
  }

  try {
    const payload = jwt.verify(regToken, REG_TOKEN_SECRET);
    if (payload.step !== 'registration') {
      return res.status(400).json({ error: 'Invalid registration token' });
    }

    if (payload.code !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Create user (email-verified)
    const { username, first_name, last_name, middle_name, email, phone, address, passwordHash } = payload;

    // Ensure username/email still available
    const existing = await pool.query('SELECT 1 FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ error: 'Username or email already in use' });
    }

    const result = await pool.query(
      `INSERT INTO users (username, password, first_name, last_name, middle_name, email, phone, address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [username, passwordHash, first_name, last_name, middle_name, email, phone, address]
    );

    return res.json({ message: 'Registration complete', userId: result.rows[0].id });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Verification expired. Please restart registration.' });
    }
    console.error('Register complete error:', err);
    return res.status(500).json({ error: 'Failed to complete registration' });
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

// --- Auth middleware for notifications ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

module.exports = router;
module.exports.verifyToken = verifyToken;
module.exports.authenticateToken = authenticateToken;

// Get current user data
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, first_name, last_name, middle_name, email, phone, address, role, approved, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Update basic profile (name, phone, address)
router.put('/update-profile', verifyToken, async (req, res) => {
  const { first_name, last_name, middle_name, phone, address } = req.body;
  
  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'First and last name are required' });
  }

  try {
    let phoneValue = null;
    if (phone && String(phone).trim() !== '') {
      const normalized = normalizePHPhone(phone);
      if (!normalized) {
        return res.status(400).json({ error: 'Enter a valid PH phone number (+63 or 09)' });
      }
      phoneValue = normalized;
    }
    await pool.query(
      'UPDATE users SET first_name = $1, last_name = $2, middle_name = $3, phone = $4, address = $5 WHERE id = $6',
      [first_name, last_name, middle_name, phoneValue, address || null, req.userId]
    );
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update username
router.put('/update-username', verifyToken, async (req, res) => {
  const { new_username } = req.body;
  
  if (!new_username) {
    return res.status(400).json({ error: 'New username is required' });
  }

  try {
    await pool.query(
      'UPDATE users SET username = $1 WHERE id = $2',
      [new_username, req.userId]
    );
    res.json({ message: 'Username updated successfully' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// Send email verification code
router.post('/send-email-verification', verifyToken, async (req, res) => {
  const { new_email } = req.body;
  
  if (!new_email) {
    return res.status(400).json({ error: 'New email is required' });
  }

  // Check if email already exists
  const { rows: existingUser } = await pool.query(
    'SELECT id FROM users WHERE email = $1 AND id != $2',
    [new_email, req.userId]
  );

  if (existingUser.length > 0) {
    return res.status(400).json({ error: 'Email already in use' });
  }

  try {
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save verification code
    await pool.query(
      'INSERT INTO verification_codes (user_id, email, code, purpose, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [req.userId, new_email, code, 'email_change', expiresAt]
    );

    // Get user's name for email
    const userResult = await pool.query('SELECT first_name, last_name, middle_name FROM users WHERE id = $1', [req.userId]);
    const u = userResult.rows[0] || {};
    const displayName = u.first_name && u.last_name
      ? `${u.first_name} ${u.last_name}${u.middle_name ? ' ' + u.middle_name.charAt(0).toUpperCase() + '.' : ''}`
      : 'User';

    // Send verification code via email
    await sendVerificationCode(new_email, displayName, code);

    res.json({ message: 'Verification code sent to new email' });
  } catch (err) {
    console.error('Verification code error:', err);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Verify code and update email
router.put('/verify-and-update-email', verifyToken, async (req, res) => {
  const { code, new_email } = req.body;
  
  if (!code || !new_email) {
    return res.status(400).json({ error: 'Code and email are required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM verification_codes 
       WHERE user_id = $1 AND email = $2 AND code = $3 AND purpose = 'email_change' 
       AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [req.userId, new_email, code]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    // Mark code as used
    await pool.query(
      'UPDATE verification_codes SET used = TRUE WHERE id = $1',
      [rows[0].id]
    );

    // Update email
    await pool.query(
      'UPDATE users SET email = $1 WHERE id = $2',
      [new_email, req.userId]
    );

    res.json({ message: 'Email updated successfully' });
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({ error: 'Failed to verify and update email' });
  }
});

// Update password
router.put('/update-password', verifyToken, async (req, res) => {
  const { current_password, new_password } = req.body;
  
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    // Get current password hash
    const { rows } = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = bcrypt.compareSync(current_password, rows[0].password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and update new password
    const hashedPassword = bcrypt.hashSync(new_password, 10);
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, req.userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Admin-only routes for user management

// Get all users (admin only)
router.get('/users', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, username, first_name, last_name, middle_name, email, phone, address, role, approved, created_at 
       FROM users 
       WHERE role = 'resident'
       ORDER BY approved ASC, created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Approve user (admin only)
router.put('/users/:id/approve', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const userId = parseInt(req.params.id);

  try {
    // Fetch current user state
    const { rows } = await pool.query(
      `SELECT id, username, first_name, last_name, middle_name, email, approved FROM users WHERE id = $1 AND role = 'resident'`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userRow = rows[0];

    if (userRow.approved) {
      // Already approved; respond idempotently
      return res.json({ message: 'User already approved', user: userRow });
    }

    // Approve the user
    const result = await pool.query(
      `UPDATE users SET approved = TRUE WHERE id = $1 RETURNING id, username, first_name, last_name, middle_name, email, approved`,
      [userId]
    );

    const updated = result.rows[0];

    // Send welcome email upon approval if email exists
    if (updated.email) {
      const welcomeName = updated.first_name && updated.last_name
        ? `${updated.first_name} ${updated.last_name}${updated.middle_name ? ' ' + updated.middle_name.charAt(0).toUpperCase() + '.' : ''}`
        : 'Resident';
      sendWelcomeEmail(updated.email, welcomeName).catch(err =>
        console.error('Failed to send welcome email:', err.message)
      );
    }

    res.json({ message: 'User approved successfully', user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

// Revoke approval (admin only)
router.put('/users/:id/revoke', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const userId = parseInt(req.params.id);

  try {
    const result = await pool.query(
      "UPDATE users SET approved = FALSE WHERE id = $1 AND role = 'resident' RETURNING *",
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User approval revoked', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke approval' });
  }
});

// Update user (admin only)
router.put('/users/:id', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const userId = parseInt(req.params.id);
  const { first_name, last_name, middle_name, email, phone, address } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).json({ error: 'First and last name are required' });
  }

  try {
    let phoneValue = null;
    if (phone && String(phone).trim() !== '') {
      const normalized = normalizePHPhone(phone);
      if (!normalized) {
        return res.status(400).json({ error: 'Enter a valid PH phone number (+63 or 09)' });
      }
      phoneValue = normalized;
    }

    const result = await pool.query(
      "UPDATE users SET first_name = $1, last_name = $2, middle_name = $3, email = $4, phone = $5, address = $6 WHERE id = $7 AND role = 'resident' RETURNING *",
      [first_name, last_name, middle_name, email || null, phoneValue, address || null, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const userId = parseInt(req.params.id);

  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 AND role = 'resident' RETURNING username",
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found or cannot be deleted' });
    }

    res.json({ message: 'User deleted successfully', username: result.rows[0].username });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});
