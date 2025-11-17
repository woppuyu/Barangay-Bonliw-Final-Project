# 📧 Email Setup Guide for Barangay Bonliw Project

## ✅ What's Already Done

The email functionality is now fully integrated! Here's what happens automatically:

1. **Welcome Email** - Sent when a resident registers (if email provided)
2. **Appointment Confirmation** - Sent when booking an appointment
3. **Status Updates** - Sent when admin changes appointment status (approved/rejected/completed)

---

## 🔧 Gmail Setup (Required Steps)

### Step 1: Enable 2-Step Verification

1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** on the left sidebar
3. Under "Signing in to Google", click **2-Step Verification**
4. Follow the prompts to turn it on (you'll need your phone)

### Step 2: Create App Password

1. After enabling 2-Step Verification, go back to **Security**
2. Under "Signing in to Google", click **App passwords**
3. Select app: **Mail**
4. Select device: **Windows Computer** (or Other)
5. Click **Generate**
6. Copy the **16-character password** (example: `abcd efgh ijkl mnop`)

### Step 3: Update .env File

Open the `.env` file and replace these lines:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password-here
```

With your actual Gmail and app password:

```env
EMAIL_USER=juan.delacruz@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
```

⚠️ **Important:** 
- Use the **16-character app password**, NOT your regular Gmail password
- Remove all spaces from the app password
- Keep the .env file secure and never commit it to GitHub

---

## 🧪 Testing the Email System

### Test 1: Registration Email

1. Start your server: `npm start`
2. Register a new account with a **real email address**
3. Check your email inbox for "Welcome to Barangay Bonliw Appointment System"

### Test 2: Appointment Confirmation

1. Login with the account that has an email
2. Book an appointment
3. Check your email for "Appointment Confirmed"

### Test 3: Status Update Email

1. Login as admin (username: `admin`, password: `admin123`)
2. Go to Admin Dashboard
3. Change an appointment status to "Approved"
4. The resident should receive a "✅ Appointment Approved" email

---

## 🔍 Troubleshooting

### "Error sending email" in terminal

**Problem:** Wrong credentials or app password not set up

**Solution:**
1. Double-check your EMAIL_USER is correct
2. Make sure you're using the **App Password**, not your regular password
3. Restart the server after changing .env

### Emails not being received

**Problem:** Email might be in spam folder

**Solution:**
1. Check your spam/junk folder
2. Mark the email as "Not Spam"
3. Add the sender to your contacts

### "Less secure app access" error

**Problem:** Google requires app passwords for security

**Solution:**
- Don't try to use "Less secure app access" - it's deprecated
- Always use **App Passwords** (see Step 2 above)

### Server error: "Invalid login"

**Problem:** App password might have spaces

**Solution:**
- Remove ALL spaces from the 16-character password
- Example: `abcd efgh ijkl mnop` → `abcdefghijklmnop`

---

## 📊 Email Templates Preview

### Welcome Email
- Subject: "Welcome to Barangay Bonliw Appointment System"
- Contains: Welcome message, feature list, getting started guide

### Appointment Confirmation
- Subject: "Appointment Confirmed - Barangay Bonliw"
- Contains: Document type, date, time, purpose, important reminders

### Status Update Emails

**Approved:**
- Subject: "✅ Appointment Approved - Barangay Bonliw"
- Contains: Confirmation, appointment details, next steps

**Rejected:**
- Subject: "❌ Appointment Rejected - Barangay Bonliw"
- Contains: Notification, reason (if provided), what to do next

**Completed:**
- Subject: "🎉 Appointment Completed - Barangay Bonliw"
- Contains: Document ready notice, pickup instructions

---

## 💡 Important Notes

### Making Email Optional
- Email is **optional** during registration
- Users without email won't receive notifications (no errors)
- Phone number field is ready for SMS integration later

### Email Won't Block Operations
- If email sending fails, registration/booking still succeeds
- Errors are logged to console but don't stop the process
- This prevents email issues from breaking the system

### Gmail Sending Limits
- Free Gmail accounts: **500 emails per day**
- More than enough for a barangay system
- If you need more, consider SendGrid or AWS SES

---

## 🚀 Next Steps (Optional)

### Want to use a different email service?

**SendGrid (Free tier: 100 emails/day):**
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

**Outlook/Hotmail:**
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

---

## ✅ Checklist

Before going live, make sure:

- [ ] 2-Step Verification enabled on Gmail
- [ ] App Password generated
- [ ] .env file updated with real credentials
- [ ] Server restarted after .env changes
- [ ] Test registration email received
- [ ] Test appointment confirmation received
- [ ] Test status update email received
- [ ] Emails not going to spam

---

## 📞 Need Help?

If you're still having issues:
1. Check the server terminal for error messages
2. Verify the app password has no spaces
3. Make sure 2-Step Verification is enabled
4. Try generating a new app password
5. Restart the server after any .env changes

**Common Error Messages:**

| Error | Solution |
|-------|----------|
| "Invalid login" | Check app password is correct (no spaces) |
| "Username and Password not accepted" | Enable 2-Step Verification first |
| "Connection timeout" | Check EMAIL_HOST and EMAIL_PORT |
| "ENOTFOUND" | Check internet connection |

---

## 🎉 You're All Set!

Once configured, emails will be sent automatically for:
- ✅ New user registrations
- ✅ Appointment bookings
- ✅ Status changes (approved/rejected/completed)

No additional code needed - it's all working now! 🚀
