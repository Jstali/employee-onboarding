# 📧 Gmail SMTP Email Setup Guide

## 🚨 IMPORTANT: You MUST use a Gmail App Password

**Regular Gmail passwords will NOT work with SMTP!** You need to generate a special App Password.

## 🔑 Step-by-Step Gmail App Password Setup

### 1. Enable 2-Step Verification

- Go to [Google Account Settings](https://myaccount.google.com/)
- Navigate to **Security** → **2-Step Verification**
- Enable 2-Step Verification if not already enabled

### 2. Generate App Password

- Go to **Security** → **2-Step Verification** → **App passwords**
- Select **"Mail"** from the dropdown
- Click **"Generate"**
- Copy the **16-character password** (no spaces)

### 3. Update Configuration

Edit `config.env`:

```env
SMTP_USER=alpha@nxen.cpm
SMTP_PASS=your_16_character_app_password_here
```

### 4. Restart Server

```bash
# Kill current server
ps aux | grep "node server.js" | grep -v grep
kill <PID>

# Start server again
npm start
```

## 🧪 Test Email Functionality

### Option 1: Use HR Dashboard

1. Login to HR dashboard
2. Go to "Test Email" section
3. Enter your email address
4. Click "Send Test Email"

### Option 2: Use Test Script

```bash
node fix-email-issues.js
```

## ❌ Common Issues & Solutions

### Issue: "Username and Password not accepted"

**Solution**: You're using regular password instead of App Password

### Issue: "Connection timeout"

**Solution**: Check internet connection and firewall settings

### Issue: "Authentication failed"

**Solution**: Verify App Password is correct and 2-Step Verification is enabled

## 🔧 Alternative Email Services

If Gmail continues to have issues, consider:

### 1. Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

### 2. Yahoo Mail

```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
```

### 3. SendGrid (Professional)

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
```

## 📋 Current Configuration

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=alpha@nxen.cpm
SMTP_PASS=alphanxzen@123  # ← This needs to be an App Password!
```

## ✅ Success Indicators

- Email appears in recipient's inbox
- Server logs show "✅ Email sent successfully"
- No authentication errors in console
- Frontend shows "Email Status: sent"

## 🆘 Need Help?

1. Check server console for detailed error messages
2. Verify Gmail App Password is 16 characters (no spaces)
3. Ensure 2-Step Verification is enabled
4. Try alternative email service if Gmail continues to fail
