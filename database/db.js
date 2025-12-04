const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Pool reads PG* vars from process.env via dotenv in server.js
// Supports both individual credentials and DATABASE_URL connection string
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || '',
        database: process.env.PGDATABASE || 'barangay_db',
      }
);

async function initialize() {
  // Ensure connection works and create schema + seed
  await pool.query('SELECT 1');
  await createSchema();
  await seedDefaults();
  console.log('Connected to PostgreSQL and ensured schema');
}

async function createSchema() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name VARCHAR(64) NOT NULL,
        last_name VARCHAR(64) NOT NULL,
        middle_name VARCHAR(64),
        email VARCHAR(128),
        phone VARCHAR(32),
        address TEXT,
        role VARCHAR(16) NOT NULL DEFAULT 'resident',
        approved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_approved ON users(approved);
    `);


    await client.query(`
      CREATE TABLE IF NOT EXISTS time_slots (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        time TIME NOT NULL,
        is_available BOOLEAN NOT NULL DEFAULT TRUE,
        CONSTRAINT uq_timeslot UNIQUE (date, time)
      );
      CREATE INDEX IF NOT EXISTS idx_timeslots_available ON time_slots(is_available, date);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service_category VARCHAR(64) NOT NULL,
        document_type VARCHAR(64),
        purpose TEXT,
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_appts_user ON appointments(user_id);
      CREATE INDEX IF NOT EXISTS idx_appts_status ON appointments(status);
      CREATE INDEX IF NOT EXISTS idx_appts_datetime ON appointments(appointment_date, appointment_time);
      CREATE INDEX IF NOT EXISTS idx_appts_service ON appointments(service_category);
      CREATE INDEX IF NOT EXISTS idx_appts_created ON appointments(created_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(128) NOT NULL,
        code VARCHAR(6) NOT NULL,
        purpose VARCHAR(32) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_verification_user ON verification_codes(user_id);
      CREATE INDEX IF NOT EXISTS idx_verification_code ON verification_codes(code);
    `);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function seedDefaults() {
  // Create default admin (always approved)
  const hash = bcrypt.hashSync('admin', 10);
  await pool.query(
    `INSERT INTO users (username, password, first_name, last_name, middle_name, role, approved)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (username) DO UPDATE SET approved = TRUE`,
    ['admin', hash, 'Administrator', 'Admin', null, 'admin', true]
  );

  // Generate time slots for next 30 days only if not present
  const { rows: slotCheck } = await pool.query('SELECT COUNT(*) FROM time_slots');
  if (parseInt(slotCheck[0].count, 10) === 0) {
    const times = ['09:00:00','10:00:00','11:00:00','13:00:00','14:00:00','15:00:00','16:00:00'];
    const start = new Date();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 1; i <= 30; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const dateStr = d.toISOString().slice(0,10);
        for (const t of times) {
          await client.query(
            `INSERT INTO time_slots (date, time) VALUES ($1,$2)
             ON CONFLICT (date, time) DO NOTHING`,
            [dateStr, t]
          );
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

module.exports = { initialize, pool };
