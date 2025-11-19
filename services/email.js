const nodemailer = require('nodemailer');

// Create email transporter (configured for Brevo/Sendinblue)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.EMAIL_PORT) || 465,
  secure: true, // Use SSL (true for port 465, false for 587)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  // Increase timeout for cloud hosting
  connectionTimeout: 15000, // 15 seconds
  greetingTimeout: 15000,
  socketTimeout: 15000,
  // Additional options for better reliability
  logger: process.env.NODE_ENV === 'development',
  debug: process.env.NODE_ENV === 'development'
});

// Verify transporter on startup to surface config issues
transporter.verify((err, success) => {
  if (err) {
    console.error('Email transporter verification failed:', err.message);
  } else {
    console.log('Email transporter is ready to send messages');
  }
});

// Send welcome email after registration
async function sendWelcomeEmail(to, fullName) {
  if (!to) return; // Skip if no email provided
  
  try {
    await transporter.sendMail({
      from: `"Barangay Bonliw" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: 'Welcome to Barangay Bonliw Appointment System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2d3748;">Welcome to Barangay Bonliw, ${fullName}!</h2>
          <p style="color: #4a5568; line-height: 1.6;">
            Your account has been successfully created. You can now:
          </p>
          <ul style="color: #4a5568; line-height: 1.8;">
            <li>Book appointments online</li>
            <li>Request barangay documents</li>
            <li>Track your appointment status in real-time</li>
          </ul>
          <p style="color: #4a5568;">
            No more waiting in long lines! Simply book your appointment and arrive at your scheduled time.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #718096; font-size: 12px;">
            This is an automated message from Barangay Bonliw Appointment System.
          </p>
        </div>
      `
    });
    console.log(`Welcome email sent to ${to}`);
  } catch (error) {
    console.error('Error sending welcome email:', error.message);
  }
}

// Send appointment confirmation
async function sendAppointmentConfirmation(to, fullName, appointment) {
  if (!to) return;
  
  try {
    await transporter.sendMail({
      from: `"Barangay Bonliw" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: 'Appointment Confirmed - Barangay Bonliw',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2d3748;">Appointment Confirmed</h2>
          <p style="color: #4a5568;">Dear ${fullName},</p>
          <p style="color: #4a5568;">
            Your appointment has been successfully scheduled. Please review the details below:
          </p>
          
          <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; color: #2d3748;">
              <tr>
                <td style="padding: 8px 0;"><strong>Document Type:</strong></td>
                <td style="padding: 8px 0;">${appointment.document_type}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Date:</strong></td>
                <td style="padding: 8px 0;">${new Date(appointment.appointment_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Time:</strong></td>
                <td style="padding: 8px 0;">${appointment.appointment_time}</td>
              </tr>
              ${appointment.purpose ? `
              <tr>
                <td style="padding: 8px 0;"><strong>Purpose:</strong></td>
                <td style="padding: 8px 0;">${appointment.purpose}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0;"><strong>Status:</strong></td>
                <td style="padding: 8px 0;"><span style="background: #fef5e7; color: #d69e2e; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">PENDING</span></td>
              </tr>
            </table>
          </div>

          <div style="background: #fff5e1; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              <strong>⚠️ Important Reminders:</strong><br>
              • Please arrive 10 minutes before your scheduled time<br>
              • Bring a valid ID and any required documents<br>
              • Your appointment is subject to approval by barangay officials
            </p>
          </div>

          <p style="color: #4a5568;">
            You can check your appointment status anytime on your dashboard.
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #718096; font-size: 12px;">
            This is an automated message from Barangay Bonliw Appointment System.
          </p>
        </div>
      `
    });
    console.log(`Appointment confirmation sent to ${to}`);
  } catch (error) {
    console.error('Error sending appointment confirmation:', error.message);
  }
}

// Send status update notification
async function sendStatusUpdate(to, fullName, appointment, oldStatus, newStatus) {
  if (!to) return;

  const statusConfig = {
    approved: {
      color: '#38a169',
      bg: '#c6f6d5',
      icon: '✅',
      title: 'Appointment Approved',
      message: 'Great news! Your appointment has been approved by barangay officials.'
    },
    rejected: {
      color: '#e53e3e',
      bg: '#fed7d7',
      icon: '❌',
      title: 'Appointment Rejected',
      message: 'Unfortunately, your appointment has been rejected.'
    },
    completed: {
      color: '#3182ce',
      bg: '#bee3f8',
      icon: '🎉',
      title: 'Appointment Completed',
      message: 'Your appointment is complete! Your document is ready for pickup.'
    }
  };

  const config = statusConfig[newStatus] || statusConfig.approved;
  
  try {
    await transporter.sendMail({
      from: `"Barangay Bonliw" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: `${config.title} - Barangay Bonliw`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${config.bg}; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: ${config.color}; margin: 0; font-size: 24px;">
              ${config.icon} ${config.title}
            </h1>
          </div>

          <p style="color: #4a5568;">Dear ${fullName},</p>
          <p style="color: #4a5568;">${config.message}</p>
          
          <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; color: #2d3748;">
              <tr>
                <td style="padding: 8px 0;"><strong>Document Type:</strong></td>
                <td style="padding: 8px 0;">${appointment.document_type}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Date:</strong></td>
                <td style="padding: 8px 0;">${new Date(appointment.appointment_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Time:</strong></td>
                <td style="padding: 8px 0;">${appointment.appointment_time}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Status:</strong></td>
                <td style="padding: 8px 0;"><span style="background: ${config.bg}; color: ${config.color}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${newStatus.toUpperCase()}</span></td>
              </tr>
              ${appointment.notes ? `
              <tr>
                <td style="padding: 8px 0;"><strong>Admin Notes:</strong></td>
                <td style="padding: 8px 0;">${appointment.notes}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          ${newStatus === 'approved' ? `
          <div style="background: #e6f7ed; border-left: 4px solid #38a169; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #22543d;">
              <strong>✓ Next Steps:</strong><br>
              • Please arrive at the scheduled time<br>
              • Bring a valid ID and required documents<br>
              • Proceed to the barangay hall reception
            </p>
          </div>
          ` : ''}

          ${newStatus === 'completed' ? `
          <div style="background: #e6f2ff; border-left: 4px solid #3182ce; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #1e3a8a;">
              <strong>📄 Document Ready:</strong><br>
              • Visit barangay hall during office hours<br>
              • Bring a valid ID for verification<br>
              • Proceed to the releasing section
            </p>
          </div>
          ` : ''}

          ${newStatus === 'rejected' ? `
          <div style="background: #fff5f5; border-left: 4px solid #e53e3e; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #742a2a;">
              <strong>ℹ️ What to do:</strong><br>
              • Contact the barangay office for more information<br>
              • You may reschedule a new appointment<br>
              • Ensure all requirements are met
            </p>
          </div>
          ` : ''}

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #718096; font-size: 12px;">
            This is an automated message from Barangay Bonliw Appointment System.
          </p>
        </div>
      `
    });
    console.log(`Status update email sent to ${to} (${oldStatus} → ${newStatus})`);
  } catch (error) {
    console.error('Error sending status update email:', error.message);
  }
}

// Send email verification code
async function sendVerificationCode(to, fullName, code) {
  if (!to) return;
  
  try {
    await transporter.sendMail({
      from: `"Barangay Bonliw" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: 'Email Verification Code - Barangay Bonliw',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2d3748;">Email Verification</h2>
          <p style="color: #4a5568;">Dear ${fullName},</p>
          <p style="color: #4a5568;">You requested to change your email address for your Barangay Bonliw account.</p>
          <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #718096; margin-bottom: 10px;">Your verification code is:</p>
            <h1 style="color: #3182ce; font-size: 36px; letter-spacing: 8px; margin: 0;">${code}</h1>
          </div>
          <p style="color: #e53e3e; font-size: 14px;">⚠️ This code expires in 10 minutes.</p>
          <p style="color: #718096; font-size: 13px;">If you didn't request this, please ignore this email and your account will remain secure.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="color: #718096; font-size: 12px;">
            This is an automated message from Barangay Bonliw Appointment System.
          </p>
        </div>
      `
    });
    console.log(`Verification code sent to ${to}`);
  } catch (error) {
    console.error('Error sending verification code:', error.message);
    throw error; // Re-throw to let caller handle it
  }
}

module.exports = {
  sendWelcomeEmail,
  sendAppointmentConfirmation,
  sendStatusUpdate,
  sendVerificationCode
};
