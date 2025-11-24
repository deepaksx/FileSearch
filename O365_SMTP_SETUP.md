# O365 Corporate Email Setup Guide

## Quick Setup

### Step 1: Update .env File

Open `C:\Dev\FileSearch\.env` and add:

```env
# O365 Email Configuration
MAIL_SERVER=smtp.office365.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USE_SSL=False
MAIL_USERNAME=your.name@yourcompany.com
MAIL_PASSWORD=YourO365Password
MAIL_DEFAULT_SENDER=your.name@yourcompany.com
```

**Replace:**
- `your.name@yourcompany.com` with your actual O365 email
- `YourO365Password` with your O365 password

### Step 2: Test the Connection

Run the test script:

```bash
python test_email.py
```

This will:
- ✅ Test SMTP connection
- ✅ Verify authentication
- ✅ Optionally send test email

### Step 3: Start Using

If test passes, you're ready!

```bash
# Start backend
python backend/app.py

# Start frontend (in another terminal)
cd frontend
npm run dev
```

---

## If You Have Multi-Factor Authentication (MFA)

### Scenario 1: Modern Authentication (Most Common)

**Good news:** Usually works without extra setup!

Just use your regular password. O365 allows app authentication even with MFA enabled.

### Scenario 2: App Password Required

If regular password doesn't work:

1. **Contact Your IT Admin:**
   - Request an "App Password" for SMTP
   - They can generate one for you
   - Or give you specific SMTP settings

2. **Alternative - Use OAuth2** (Advanced):
   - More secure but complex setup
   - Ask IT if they prefer this method

---

## Common O365 SMTP Settings

### Standard Configuration:
```env
MAIL_SERVER=smtp.office365.com
MAIL_PORT=587
MAIL_USE_TLS=True
```

### Alternative Port (if 587 blocked):
```env
MAIL_SERVER=smtp.office365.com
MAIL_PORT=25
MAIL_USE_TLS=True
```

### For Office 365 Government:
```env
MAIL_SERVER=smtp.office365.us
MAIL_PORT=587
MAIL_USE_TLS=True
```

---

## Checking with IT Department

### Questions to Ask:

**1. "Can I use SMTP authentication for automated emails?"**
- Some companies disable this for security

**2. "What are the SMTP settings?"**
- Server: Usually `smtp.office365.com`
- Port: Usually `587`
- TLS: Usually `Yes`

**3. "Are there any sending limits?"**
- Default: 10,000 emails/day
- Your company might have different limits

**4. "Do I need special permissions?"**
- Some companies require approval for automated email

**5. "Should I use a specific sender address?"**
- You might have a `noreply@company.com` address
- Better than using your personal work email

---

## Best Practices for Corporate Email

### ✅ DO:

1. **Use a service account** (if available):
   ```env
   MAIL_USERNAME=noreply@yourcompany.com
   MAIL_PASSWORD=ServiceAccountPassword
   ```

2. **Check company policies:**
   - Get approval from IT
   - Follow security guidelines

3. **Keep credentials secure:**
   - Never commit `.env` to git
   - Use environment variables in production

4. **Monitor sending:**
   - Keep track of email volume
   - Stay within limits

### ❌ DON'T:

1. **Don't use personal email** for production
2. **Don't exceed sending limits**
3. **Don't share credentials**
4. **Don't bypass IT policies**

---

## Troubleshooting

### Error: "Authentication Failed"

**Possible causes:**
1. Wrong password
   - ✅ Try logging into Outlook web with same credentials
   - ✅ Reset password if needed

2. MFA blocking
   - ✅ Contact IT for app password
   - ✅ Or ask if modern auth is enabled

3. SMTP disabled
   - ✅ IT admin needs to enable SMTP authentication
   - ✅ Check in Microsoft 365 admin center

### Error: "Connection Timeout"

**Possible causes:**
1. Firewall blocking port 587
   - ✅ Try port 25 instead
   - ✅ Contact IT about firewall rules

2. VPN required
   - ✅ Connect to company VPN
   - ✅ Test again

3. Wrong server address
   - ✅ Verify with IT: `smtp.office365.com`

### Error: "Relay Access Denied"

**Possible causes:**
1. Sending to external email without permission
   - ✅ Configure "relay" settings with IT
   - ✅ Or use email only for internal testing

### Emails Going to Spam

**Solutions:**
1. **SPF Record** - IT needs to configure DNS
2. **DKIM** - IT needs to enable
3. **Professional content** - Avoid spam words
4. **Test internally first** - Send to coworkers

---

## Alternative: Dedicated Email Account

### Recommended Approach:

Ask IT to create a dedicated service account:

```
Email: filesearch-noreply@yourcompany.com
Purpose: Automated OTP emails
Permissions: Send-only, no mailbox needed
```

**Benefits:**
- ✅ Separate from personal account
- ✅ Can be managed by team
- ✅ Better for production
- ✅ Professional appearance

**Example .env:**
```env
MAIL_USERNAME=filesearch-noreply@yourcompany.com
MAIL_PASSWORD=ServiceAccountPassword123!
MAIL_DEFAULT_SENDER=filesearch-noreply@yourcompany.com
```

---

## Testing Checklist

Run through this before going live:

- [ ] Updated .env with O365 credentials
- [ ] Ran `python test_email.py` successfully
- [ ] Received test email in inbox
- [ ] IT department aware/approved
- [ ] Tested password reset flow end-to-end
- [ ] Checked spam folder doesn't catch emails
- [ ] Verified sending limits are adequate
- [ ] Secured .env file (not in git)

---

## Sending Limits

### O365 Standard Limits:
- **10,000 emails per day** (per account)
- **30 messages per minute**
- **500 recipients per message**

### For Your OTP Use Case:
- Each password reset = 1 email
- Each verification = 1 email
- **Should be more than enough!**

### If You Need More:
- Ask IT about increasing limits
- Or use dedicated email service (SendGrid, Mailgun)

---

## Production Considerations

### Security:

1. **Use service account** (not personal)
2. **Rotate passwords** regularly
3. **Enable logging** to track sends
4. **Monitor for abuse**

### Compliance:

1. **Check company policies** on automated emails
2. **Include unsubscribe** if needed
3. **GDPR compliance** for EU users
4. **Data retention** policies

### Monitoring:

1. **Track delivery rates**
2. **Monitor bounces**
3. **Watch for blocks**
4. **Alert on failures**

---

## Need Help from IT?

### Email Template to Send:

```
Subject: SMTP Access Request for FileSearch Application

Hi IT Team,

I'm developing an internal application (FileSearch) that needs to send
automated emails for:
- User email verification (OTP codes)
- Password reset requests

Requirements:
- SMTP access to smtp.office365.com:587
- Estimated volume: ~50 emails/day
- Sender: [my.email@company.com or dedicated account]

Could you please:
1. Confirm SMTP authentication is enabled for my account
2. Provide any specific configuration needed
3. Let me know if I need a dedicated service account

Technical details:
- Using Flask-Mail library
- TLS encryption enabled
- Credentials stored securely in environment variables

Thank you!
```

---

## Summary

**O365 is a GREAT choice for this!**

✅ Professional sender address
✅ Higher sending limits than Gmail
✅ Already have access
✅ Free (company pays for O365)
✅ Better deliverability

Just make sure IT is aware and approves! 👍

---

## Next Steps

1. ✅ Update `.env` with O365 credentials
2. ✅ Run `python test_email.py`
3. ✅ Test password reset in app
4. ✅ Get IT approval (if needed)
5. ✅ Go to production!
