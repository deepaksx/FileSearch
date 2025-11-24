# OTP Email Authentication

This application now includes email-based OTP (One-Time Password) authentication for email verification and password reset functionality.

## Features

1. **Email Verification** - Users can verify their email addresses using a 6-digit OTP code
2. **Password Reset** - Users can reset their passwords via email OTP
3. **Secure OTP Storage** - OTP codes are stored in the database with expiration (15 minutes)
4. **Email Integration** - Automated email delivery using Flask-Mail

## Setup Instructions

### 1. Install Dependencies

The required package `flask-mail` has been added to `requirements.txt`. Install it with:

```bash
pip install flask-mail
```

### 2. Configure Email Settings

Add the following configuration to your `.env` file:

```env
# Email Configuration for OTP
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USE_SSL=False
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-specific-password
MAIL_DEFAULT_SENDER=your-email@gmail.com
```

#### For Gmail Users:

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Visit https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the generated 16-character password
   - Use this as your `MAIL_PASSWORD` in the `.env` file

#### For Other Email Providers:

Update the `MAIL_SERVER` and `MAIL_PORT` according to your provider:
- **Outlook/Hotmail**: `smtp.office365.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`
- **Custom SMTP**: Use your provider's SMTP settings

### 3. Database Migration

The User model has been updated with new fields. You'll need to either:

**Option A: Reset the database** (for development):
```bash
# Delete the existing database
rm backend/filesearch.db

# Restart the application - it will create the new schema
python backend/app.py
```

**Option B: Migrate existing database** (for production):
```sql
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN otp_code VARCHAR(6);
ALTER TABLE users ADD COLUMN otp_created_at DATETIME;
```

## API Endpoints

### 1. Send Verification OTP
**POST** `/api/auth/send-verification-otp`

Request:
```json
{
  "email": "user@example.com"
}
```

Response:
```json
{
  "success": true,
  "message": "Verification code sent to your email"
}
```

### 2. Verify Email
**POST** `/api/auth/verify-email`

Request:
```json
{
  "email": "user@example.com",
  "otp_code": "123456"
}
```

Response:
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

### 3. Request Password Reset
**POST** `/api/auth/request-password-reset`

Request:
```json
{
  "email": "user@example.com"
}
```

Response:
```json
{
  "success": true,
  "message": "If the email exists, a reset code has been sent"
}
```

### 4. Reset Password
**POST** `/api/auth/reset-password`

Request:
```json
{
  "email": "user@example.com",
  "otp_code": "123456",
  "new_password": "newpassword123"
}
```

Response:
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

## Frontend Components

Three new React components have been added:

1. **VerifyEmail.jsx** - Email verification interface
2. **ForgotPassword.jsx** - Request password reset
3. **ResetPassword.jsx** - Reset password with OTP

The `App.jsx` has been updated to handle navigation between these views.

## User Flow

### Email Verification Flow
1. User receives email with 6-digit OTP
2. User enters OTP in verification form
3. System validates OTP and marks email as verified
4. User can resend OTP if needed (generates new code)

### Password Reset Flow
1. User clicks "Forgot Password?" on login page
2. User enters their email address
3. System sends OTP to email (if account exists)
4. User enters OTP and new password
5. System validates OTP and updates password
6. User can log in with new password

## Security Features

- **OTP Expiration**: Codes expire after 15 minutes
- **6-Digit Codes**: 1,000,000 possible combinations
- **Single Use**: OTP is cleared after successful verification
- **Rate Limiting**: Consider adding rate limiting for production
- **No Email Enumeration**: Password reset doesn't reveal if email exists

## Optional: Enforce Email Verification

To require email verification before login, uncomment this code in `backend/app.py`:

```python
# In the login endpoint (around line 127)
if not user.email_verified and user.role != 'admin':
    return jsonify({
        "error": "Email not verified",
        "email_verified": False,
        "email": user.email
    }), 403
```

## Testing

### Test OTP Functionality:

1. Start the backend: `python backend/app.py`
2. Start the frontend: `npm run dev` (in frontend directory)
3. Create a test user via admin dashboard
4. Test password reset:
   - Click "Forgot Password?"
   - Enter user's email
   - Check email for OTP code
   - Enter OTP and new password

### Development Testing (Without Email):

For development, you can check the console output. The OTP code is printed when generated:
```python
print(f"Generated OTP: {otp_code}")  # Add this to your endpoints for testing
```

## Troubleshooting

### Emails not sending:
1. Verify SMTP credentials in `.env`
2. Check if Gmail App Password is correct
3. Ensure 2FA is enabled on Gmail
4. Check application logs for errors

### OTP expired errors:
- OTP codes expire after 15 minutes
- Request a new OTP code
- Check server time is correct

### Database errors:
- Ensure database schema is updated with new fields
- Run database migration or reset database

## Production Considerations

1. **Rate Limiting**: Implement rate limiting for OTP endpoints
2. **Email Templates**: Create HTML email templates
3. **Logging**: Add detailed logging for debugging
4. **Monitoring**: Monitor email delivery success rates
5. **Backup Email Provider**: Consider fallback SMTP provider
6. **Security Headers**: Implement proper CORS and security headers
7. **HTTPS**: Always use HTTPS in production

## Database Schema Changes

New fields added to the `users` table:

```python
email_verified = Column(Boolean, default=False, nullable=False)
otp_code = Column(String(6), nullable=True)
otp_created_at = Column(DateTime, nullable=True)
```

## Support

For issues or questions:
1. Check server logs for error messages
2. Verify email configuration in `.env`
3. Test email connectivity with a simple test script
4. Review Flask-Mail documentation: https://pythonhosted.org/Flask-Mail/
