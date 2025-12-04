require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database/db');
const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const notificationRoutes = require('./routes/notifications');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stats', statsRoutes);

// Health check for platform uptime probes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/my-appointments', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'my-appointments.html'));
});

app.get('/book-appointment', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'book-appointment.html'));
});

app.get('/pending-approval', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pending-approval.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin-stats', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-stats.html'));
});

app.get('/manage-users', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage-users.html'));
});

// Initialize database and start server
console.log('Starting server initialization...');
console.log('PORT:', PORT);
console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('PGHOST:', process.env.PGHOST);

db.initialize().then(() => {
  console.log('Database initialized successfully');
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  console.error('Error details:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
});
