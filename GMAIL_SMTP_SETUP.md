# Gmail SMTP Setup Guide (5 Minutes)

## Step-by-Step Instructions

### Step 1: Enable 2-Factor Authentication

1. Go to your Google Account: https://myaccount.google.com/security
2. Scroll to "How you sign in to Google"
3. Click on "2-Step Verification"
4. Click "Get Started" and follow the prompts
5. Complete the setup (you'll need your phone)

### Step 2: Generate App Password

1. Go to: https://myaccount.google.com/apppasswords
2. You might need to sign in again
3. Under "Select app" choose "Mail"
4. Under "Select device" choose "Other (Custom name)"
5. Type: "FileSearch App"
6. Click "Generate"
7. **IMPORTANT:** Copy the 16-character password shown
   - Example: `abcd efgh ijkl mnop`
   - You won't see this again!

### Step 3: Update Your .env File

Open `C:\Dev\FileSearch\.env` and update:

```env
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USE_SSL=False
MAIL_USERNAME=your.email@gmail.com
MAIL_PASSWORD=abcdefghijklmnop  # Paste the 16-char password (remove spaces)
MAIL_DEFAULT_SENDER=your.email@gmail.com
```

**Replace:**
- `your.email@gmail.com` with YOUR Gmail address
- `abcdefghijklmnop` with YOUR generated app password (no spaces)

### Step 4: Test It!

1. Start the backend:
   ```bash
   python backend/app.py
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Test password reset:
   - Go to login page
   - Click "Forgot Password?"
   - Enter an email that exists in your system
   - Check your Gmail inbox for the OTP code

## Troubleshooting

### "Authentication failed" error
- ❌ Wrong app password → Generate a new one
- ❌ Spaces in password → Remove all spaces
- ❌ Used regular password → Must use app password

### No email received
- Check spam/junk folder
- Wait 1-2 minutes (sometimes delayed)
- Check backend console for errors
- Verify email address is correct

### "2-Step Verification required"
- You MUST enable 2FA first
- Can't generate app passwords without 2FA

### "Less secure app access"
- This is OLD method - don't use it
- Use app passwords instead (requires 2FA)

## Example .env Configuration

```env
# Email Configuration (Gmail Example)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USE_SSL=False
MAIL_USERNAME=john.doe@gmail.com
MAIL_PASSWORD=xyzhwklmnopqrstu
MAIL_DEFAULT_SENDER=john.doe@gmail.com
```

## Testing Checklist

- [ ] 2FA is enabled on Gmail
- [ ] App password generated and copied
- [ ] .env file updated with correct credentials
- [ ] No spaces in the app password
- [ ] Used YOUR email address (not example)
- [ ] Backend starts without errors
- [ ] Can request password reset
- [ ] Email arrives in inbox

## Gmail Limitations

⚠️ **Important Notes:**
- Maximum: 500 emails per day
- May go to spam for some users
- Not recommended for production
- OK for development and testing

For production, consider:
- SendGrid (100 free emails/day)
- Mailgun (100 free emails/day)
- Brevo (300 free emails/day)

## Need Help?

Common issues:
1. **Wrong credentials** → Double-check email and app password
2. **Port blocked** → Use port 587 with TLS (not 465)
3. **Firewall** → Allow outbound connections on port 587
4. **Backend not reading .env** → Restart backend after changing .env

---

That's it! You should now be able to send OTP emails. 📧
