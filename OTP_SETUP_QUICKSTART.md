# OTP Authentication - Quick Setup Guide

## What's New

Your FileSearch application now supports:
- ✅ Email verification via OTP
- ✅ Password reset via email OTP
- ✅ 6-digit OTP codes (15-minute expiry)
- ✅ Resend OTP functionality
- ✅ Complete frontend UI for all flows

## Quick Setup (5 minutes)

### Step 1: Install Dependencies
```bash
cd backend
pip install flask-mail
```

### Step 2: Configure Email in .env

Add these lines to your `.env` file:

```env
# Email Configuration for OTP
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USE_SSL=False
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-gmail-app-password
MAIL_DEFAULT_SENDER=your-email@gmail.com
```

### Step 3: Get Gmail App Password

1. Enable 2FA on your Gmail account
2. Go to https://myaccount.google.com/apppasswords
3. Create new app password for "Mail"
4. Copy the 16-character password
5. Paste it as `MAIL_PASSWORD` in your `.env`

### Step 4: Reset Database (Development Only)

The database schema has changed. For development, simply delete and recreate:

**Windows:**
```bash
del backend\filesearch.db
```

**Linux/Mac:**
```bash
rm backend/filesearch.db
```

The app will automatically create the new schema on restart.

### Step 5: Test It!

1. Start backend: `python backend/app.py`
2. Start frontend: `cd frontend && npm run dev`
3. Go to login page
4. Click "Forgot Password?"
5. Enter email and check your inbox for OTP

## New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/send-verification-otp` | POST | Send verification email |
| `/api/auth/verify-email` | POST | Verify email with OTP |
| `/api/auth/request-password-reset` | POST | Send password reset OTP |
| `/api/auth/reset-password` | POST | Reset password with OTP |

## Frontend Changes

**New Components:**
- `VerifyEmail.jsx` - Email verification screen
- `ForgotPassword.jsx` - Request reset screen
- `ResetPassword.jsx` - Reset password screen

**Updated:**
- `Login.jsx` - Added "Forgot Password?" link
- `App.jsx` - Handles OTP flow navigation
- `api.js` - New OTP API functions

## Database Changes

New columns in `users` table:
- `email_verified` - Boolean flag
- `otp_code` - 6-digit code
- `otp_created_at` - Timestamp for expiry

## Testing Checklist

- [ ] Backend starts without errors
- [ ] Can access login page
- [ ] "Forgot Password?" link appears
- [ ] Can request password reset
- [ ] Email arrives with OTP code
- [ ] Can reset password with OTP
- [ ] Can resend OTP if needed
- [ ] OTP expires after 15 minutes

## Troubleshooting

**Emails not sending?**
- Check Gmail app password is correct
- Verify 2FA is enabled on Gmail
- Check `.env` file has no typos
- Look at backend console for error messages

**Database errors?**
- Delete `filesearch.db` and restart
- Or run the SQL migration from full documentation

**Frontend errors?**
- Clear browser cache
- Check browser console for errors
- Verify frontend is connecting to backend

## Optional: Enforce Email Verification

To require users verify email before login, edit `backend/app.py` line 127:

```python
# Uncomment these lines:
if not user.email_verified and user.role != 'admin':
    return jsonify({
        "error": "Email not verified",
        "email_verified": False,
        "email": user.email
    }), 403
```

## Using Other Email Providers

**Outlook/Hotmail:**
```env
MAIL_SERVER=smtp.office365.com
MAIL_PORT=587
```

**Yahoo:**
```env
MAIL_SERVER=smtp.mail.yahoo.com
MAIL_PORT=587
```

**Custom SMTP:**
Contact your email provider for SMTP settings.

## Files Changed/Added

**Backend:**
- ✏️ `backend/models.py` - Added OTP fields and methods
- ✏️ `backend/app.py` - Added OTP endpoints
- ➕ `backend/email_utils.py` - Email sending functionality
- ✏️ `backend/requirements.txt` - Added flask-mail

**Frontend:**
- ➕ `frontend/src/components/VerifyEmail.jsx`
- ➕ `frontend/src/components/ForgotPassword.jsx`
- ➕ `frontend/src/components/ResetPassword.jsx`
- ✏️ `frontend/src/components/Login.jsx`
- ✏️ `frontend/src/App.jsx`
- ✏️ `frontend/src/utils/api.js`

**Configuration:**
- ✏️ `.env` - Added email settings
- ✏️ `.env.example` - Updated template

## Need Help?

See `OTP_AUTHENTICATION.md` for:
- Detailed API documentation
- Security considerations
- Production deployment tips
- Advanced configuration options

## Production Checklist

Before deploying to production:
- [ ] Use strong SMTP password
- [ ] Enable rate limiting on OTP endpoints
- [ ] Use HTTPS for all connections
- [ ] Set up email delivery monitoring
- [ ] Configure proper CORS headers
- [ ] Test email delivery thoroughly
- [ ] Consider backup SMTP provider
- [ ] Set up logging and monitoring

---

That's it! You now have complete OTP authentication. 🎉
