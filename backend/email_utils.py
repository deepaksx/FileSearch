"""Email utility functions for sending OTP emails"""
from flask_mail import Mail, Message
import os
from dotenv import load_dotenv

load_dotenv()

mail = None

def init_mail(app):
    """Initialize Flask-Mail with app config"""
    global mail

    # Check if email is configured
    if not os.getenv('MAIL_USERNAME') or not os.getenv('MAIL_PASSWORD'):
        print("WARNING: Email not configured. OTP features will not work.")
        print("   Set MAIL_USERNAME and MAIL_PASSWORD environment variables to enable email.")
        return None

    app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
    app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
    app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL', 'False').lower() == 'true'
    app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
    app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
    app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', os.getenv('MAIL_USERNAME'))

    mail = Mail(app)
    print("Email configured successfully")
    return mail


def send_otp_email(recipient_email, otp_code, purpose='verification'):
    """Send OTP email to user

    Args:
        recipient_email: Email address of recipient
        otp_code: The 6-digit OTP code
        purpose: Either 'verification' or 'reset' to customize the message
    """
    if not mail:
        raise Exception("Mail not initialized. Call init_mail() first.")

    if purpose == 'verification':
        subject = "Verify Your Email - FileSearch"
        body = f"""
Hello,

Thank you for registering with FileSearch!

Your email verification code is: {otp_code}

This code will expire in 15 minutes.

If you did not request this verification, please ignore this email.

Best regards,
FileSearch Team
"""
    else:  # password reset
        subject = "Password Reset Request - FileSearch"
        body = f"""
Hello,

We received a request to reset your password for your FileSearch account.

Your password reset code is: {otp_code}

This code will expire in 15 minutes.

If you did not request a password reset, please ignore this email. Your password will remain unchanged.

Best regards,
FileSearch Team
"""

    try:
        msg = Message(
            subject=subject,
            recipients=[recipient_email],
            body=body
        )
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False
