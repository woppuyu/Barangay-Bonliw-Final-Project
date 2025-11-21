# Barangay Appointment Scheduling and Transaction Management System

## 📋 Overview
A web-based system that allows residents of a Barangay to schedule appointments and request documents such as Barangay Certificates, Clearance, Indigency forms, and other transactions online. This system eliminates the need for physical visits to the barangay hall, reducing waiting times and improving service accessibility.

## ✨ Features
- **User Authentication**: Secure registration and login for residents and administrators
- **Appointment Scheduling**: Book appointments with available time slots (next 30 days)
- **Document Request Management**: Request various barangay documents online
- **Status Tracking**: Real-time tracking of appointment and document request status
- **Admin Dashboard**: Comprehensive dashboard for managing all appointments
- **Time Slot Management**: Automatic generation and availability tracking
- **Role-Based Access Control**: Separate interfaces for residents and administrators

## 🚀 Technology Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (production-grade relational database)
- **Security**: bcrypt (password hashing), JWT (authentication tokens)
- **Architecture**: RESTful API design

## 📦 Prerequisites

Before running this project, ensure you have the following installed:

- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **PostgreSQL** 15.x or higher ([Download](https://www.postgresql.org/download/))
- **npm** (comes with Node.js)

## 🛠️ Installation & Setup

### Step 1: Install PostgreSQL

1. Download and install PostgreSQL from the official website
2. During installation, set a strong password for the `postgres` superuser
3. Keep the default port `5432` (or note it if you change it)
4. PostgreSQL service should start automatically after installation

### Step 2: Create Database and User

Open PowerShell and run the following commands:

```powershell
# Create the application database user
psql -U postgres -h localhost -c "CREATE ROLE barangay_user WITH LOGIN PASSWORD 'your_secure_password';"

# Create the application database
psql -U postgres -h localhost -c "CREATE DATABASE barangay_db OWNER barangay_user;"

# Verify the setup
psql -U barangay_user -h localhost -d barangay_db -c "\conninfo"
```

**Alternative**: Use SQL Shell (psql) from Start Menu:
```sql
CREATE ROLE barangay_user WITH LOGIN PASSWORD 'your_secure_password';
CREATE DATABASE barangay_db OWNER barangay_user;
\c barangay_db barangay_user
\conninfo
```

### Step 3: Clone/Download Project

```powershell
# Navigate to your desired directory
cd C:\Users\YourName\Projects

# If using Git
git clone <repository-url>
cd "Final Project"

# Or extract the ZIP file and navigate to the folder
```

### Step 4: Configure Environment Variables

1. Copy the example environment file:
   ```powershell
   copy .env.example .env
   ```

2. Open `.env` in a text editor and update the values:
   ```ini
   PORT=3000
   NODE_ENV=development

   # PostgreSQL Configuration
   PGHOST=localhost
   PGPORT=5432
   PGDATABASE=barangay_db
   PGUSER=barangay_user
   PGPASSWORD=your_secure_password

   # Security (generate a random string for JWT_SECRET)
   JWT_SECRET=your_long_random_secret_key_here
   BCRYPT_SALT_ROUNDS=10

   # Email Configuration (Gmail)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   ```

3. Generate a secure JWT secret:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Copy the output and paste it as your `JWT_SECRET` value.

4. **Set up Gmail for sending emails:**
   
   a. Enable 2-Step Verification on your Google Account:
      - Go to https://myaccount.google.com/security
      - Click "2-Step Verification" and follow the setup steps
   
   b. Generate an App Password:
      - Go to https://myaccount.google.com/apppasswords
      - Select "Mail" as the app and "Other" as the device
      - Name it "Barangay App" or similar
      - Click "Generate"
      - Copy the 16-character password (without spaces)
   
   c. Update your `.env` file:
      ```ini
      EMAIL_USER=your-email@gmail.com
      EMAIL_PASSWORD=abcd efgh ijkl mnop  # Remove spaces: abcdefghijklmnop
      ```
   
   **Note**: Use the App Password, NOT your regular Gmail password!

### Step 5: Install Dependencies

```powershell
npm install
```

This will install all required packages:
- express (web framework)
- pg (PostgreSQL client)
- bcryptjs (password encryption)
- jsonwebtoken (authentication)
- nodemailer (email sending)
- cors (cross-origin support)
- body-parser (request parsing)
- dotenv (environment variables)

### Step 6: Start the Application

```powershell
npm start
```

The server will:
- Connect to PostgreSQL
- Auto-create database tables (users, appointments, time_slots)
- Seed default admin account
- Generate time slots for the next 30 days
- Start listening on `http://localhost:3000`

Expected output:
```
Email transporter is ready to send messages
Connected to PostgreSQL and ensured schema
Server running on http://localhost:3000
```

**Note**: If you see "Email transporter verification failed", double-check your Gmail App Password in `.env`.

### Step 7: Access the Application

Open your web browser and navigate to: **http://localhost:3000**

## 👤 Default Credentials

**Administrator Account:**
- Username: `admin`
- Password: `admin123`

**⚠️ Important**: Change the default admin password after first login in production!

## 📱 Usage Guide

### For Residents

1. **Register**: Create an account with your details
2. **Login**: Access your dashboard
3. **Book Appointment**: 
   - Select document type (Barangay Clearance, Certificate of Residency, Certificate of Relationship, Certificate of Indigency, Others)
   - Choose available date and time
   - Submit appointment request
4. **Track Status**: View your appointments and their current status
5. **Cancel**: Cancel pending appointments if needed

### For Administrators

1. **Login**: Use admin credentials
2. **View Appointments**: See all resident appointments with contact details
3. **Update Status**: Change appointment status (Pending → Approved → Completed/Rejected)
4. **Add Notes**: Include additional information for residents
5. **Manage Requests**: Process document requests efficiently

## 🗂️ Project Structure

```
Final Project/
├── server.js              # Main application entry point
├── package.json           # Project dependencies and scripts
├── .env                   # Environment variables (not in Git)
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
├── README.md              # Project documentation
├── database/
│   └── db.js              # PostgreSQL connection and schema
├── routes/
│   ├── auth.js            # Authentication endpoints (login/register)
│   └── appointments.js    # Appointment management endpoints
└── public/
    ├── index.html         # Landing page
    ├── login.html         # Login page
    ├── register.html      # Registration page
    ├── dashboard.html     # Resident dashboard
    ├── admin.html         # Admin dashboard
    ├── css/
    │   └── style.css      # Application styles
    └── js/
        ├── login.js       # Login functionality
        ├── register.js    # Registration functionality
        ├── dashboard.js   # Resident dashboard logic
        └── admin.js       # Admin dashboard logic
```

## 🔍 Database Schema

### Users Table
- Stores resident and admin accounts
- Passwords are hashed with bcrypt
- Role-based access control (resident/admin)

Note: Users now store split name fields: `first_name`, `last_name`, and optional `middle_name` (displayed as middle initial). Legacy `full_name` is no longer used.

### Time Slots Table
- Available appointment time slots
- Auto-generated for 30 days ahead
- Availability tracking (booked/available)

### Appointments Table
- Links users to their appointments
- Document type and purpose
- Status tracking (pending/approved/completed/rejected)
- Admin notes field

## 🔧 Troubleshooting

### Connection Errors

**Error**: `password authentication failed for user "barangay_user"`
- **Solution**: Verify `.env` PGPASSWORD matches the role password you created
- Test login: `psql -U barangay_user -h localhost -d barangay_db`

**Error**: `psql: command not found`
- **Solution**: Add PostgreSQL to PATH or use full path:
  ```powershell
  & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U barangay_user -h localhost -d barangay_db
  ```

**Error**: `Failed to initialize database`
- **Solution**: Ensure PostgreSQL service is running
  ```powershell
  Get-Service postgresql* | Start-Service
  ```

### Common Issues

**Port already in use**
- Change `PORT` in `.env` to an available port (e.g., 3001, 8080)

**Cannot connect to database**
1. Verify PostgreSQL is running
2. Check PGHOST, PGPORT, PGDATABASE in `.env`
3. Ensure database and user exist:
   ```powershell
   psql -U postgres -h localhost -l
   ```

**Module not found errors**
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then `npm install`

**Email not sending**
1. Verify Gmail App Password is correct (16 characters, no spaces)
2. Check that 2-Step Verification is enabled on your Google Account
3. Try generating a new App Password
4. Check the console logs for specific error messages

## 🗄️ Database Management

### View Data (PowerShell)

```powershell
# List all tables
psql -U barangay_user -h localhost -d barangay_db -c "\dt"

# View users
psql -U barangay_user -h localhost -d barangay_db -c "SELECT id, username, role FROM users;"

# View appointments
psql -U barangay_user -h localhost -d barangay_db -c "SELECT * FROM appointments ORDER BY appointment_date DESC;"

# Check available time slots
psql -U barangay_user -h localhost -d barangay_db -c "SELECT date, time, is_available FROM time_slots WHERE is_available = TRUE LIMIT 20;"
```

### Using pgAdmin (GUI)

1. Open pgAdmin 4
2. Add Server:
   - Name: `Local Development`
   - Host: `localhost`
   - Port: `5432`
   - Username: `barangay_user`
   - Password: (from your `.env`)
3. Navigate: Servers → Databases → barangay_db → Schemas → public → Tables
4. Right-click table → View/Edit Data

### Backup Database

```powershell
# Create backup
pg_dump -U postgres -h localhost -F c -d barangay_db -f barangay_backup.dump

# Restore backup
pg_restore -U postgres -h localhost -d barangay_db barangay_backup.dump
```

### Migrating From `full_name` To Split Fields

If your existing `users` table still has a legacy `full_name` column and lacks split name columns, run this one-time migration in psql:

```sql
-- Add new columns if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name TEXT;

-- Naive backfill by splitting on spaces (adjust as needed)
UPDATE users SET 
   first_name = COALESCE(first_name, split_part(full_name, ' ', 1)),
   last_name = COALESCE(last_name, NULLIF(split_part(full_name, ' ', array_length(regexp_split_to_array(full_name, '\\s+'), 1)), '')),
   middle_name = COALESCE(middle_name, NULLIF(
      CASE 
         WHEN array_length(regexp_split_to_array(full_name, '\\s+'), 1) > 2 
         THEN (array_to_string(
                     (regexp_split_to_array(full_name, '\\s+'))[2:array_length(regexp_split_to_array(full_name, '\\s+'),1)-1],
                     ' '
                  ))
         ELSE NULL
      END,
      ''
   ));

-- Optional: keep full_name for reference or drop it once validated
-- ALTER TABLE users DROP COLUMN full_name;
```

New code paths expect `first_name` and `last_name` at minimum; `middle_name` is optional and displayed as an initial when present.

## 📄 API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate and receive JWT token

### Appointments
- `GET /api/appointments/time-slots?date=YYYY-MM-DD` - Get available time slots
- `POST /api/appointments` - Create new appointment
- `GET /api/appointments/my-appointments` - Get user's appointments
- `GET /api/appointments/all` - Get all appointments (admin only)
- `PUT /api/appointments/:id/status` - Update appointment status (admin only)
- `DELETE /api/appointments/:id` - Cancel appointment

All protected endpoints require `Authorization: Bearer <token>` header.

## 🤝 Contributing

This is an academic project. For improvements:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues or questions:
- Check the Troubleshooting section above
- Review PostgreSQL and Node.js documentation
- Consult your project supervisor/instructor

## 📝 License

MIT License - Academic Project

## 🎓 Academic Context

This project fulfills requirements for:
- Web Systems and Technologies
- System Integration and Architecture
- System Analysis and Design

**Demonstrates:**
- Full-stack web development
- Database design and integration
- RESTful API architecture
- Security best practices
- User authentication and authorization
- Transaction management
- Professional code structure
