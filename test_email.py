"""
Quick test script to verify O365 SMTP connection
Run this before starting the app to test email configuration
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_smtp_connection():
    """Test SMTP connection and send a test email"""

    # Get configuration from .env
    smtp_server = os.getenv('MAIL_SERVER', 'smtp.office365.com')
    smtp_port = int(os.getenv('MAIL_PORT', 587))
    username = os.getenv('MAIL_USERNAME')
    password = os.getenv('MAIL_PASSWORD')
    sender = os.getenv('MAIL_DEFAULT_SENDER', username)

    print("=" * 50)
    print("Testing SMTP Configuration")
    print("=" * 50)
    print(f"Server: {smtp_server}:{smtp_port}")
    print(f"Username: {username}")
    print(f"Sender: {sender}")
    print(f"Password: {'*' * len(password) if password else 'NOT SET'}")
    print("=" * 50)

    if not username or not password:
        print("\n❌ ERROR: MAIL_USERNAME or MAIL_PASSWORD not set in .env file")
        return False

    try:
        print("\n🔄 Connecting to SMTP server...")

        # Create SMTP connection
        server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
        server.ehlo()

        print("✅ Connected to server")
        print("🔄 Starting TLS encryption...")

        server.starttls()
        server.ehlo()

        print("✅ TLS encryption enabled")
        print("🔄 Attempting login...")

        # Try to login
        server.login(username, password)

        print("✅ Login successful!")
        print("\n" + "=" * 50)
        print("🎉 SMTP Configuration is WORKING!")
        print("=" * 50)

        # Ask if user wants to send test email
        send_test = input("\nDo you want to send a test email? (yes/no): ").lower().strip()

        if send_test in ['yes', 'y']:
            recipient = input("Enter recipient email address: ").strip()

            if recipient:
                print(f"\n🔄 Sending test email to {recipient}...")

                # Create test email
                msg = MIMEMultipart()
                msg['From'] = sender
                msg['To'] = recipient
                msg['Subject'] = "Test Email - FileSearch OTP System"

                body = """
Hello!

This is a test email from your FileSearch application.

If you received this, your SMTP configuration is working correctly!

Test Details:
- Server: {}
- Sender: {}
- Time: {}

Your OTP email system is ready to use!

Best regards,
FileSearch Team
""".format(smtp_server, sender, __import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S'))

                msg.attach(MIMEText(body, 'plain'))

                server.send_message(msg)

                print("✅ Test email sent successfully!")
                print(f"📧 Check {recipient} inbox (and spam folder)")

        server.quit()
        return True

    except smtplib.SMTPAuthenticationError as e:
        print("\n❌ Authentication Failed!")
        print("Possible issues:")
        print("  - Wrong username or password")
        print("  - MFA enabled (need app password)")
        print("  - Account locked or disabled")
        print(f"\nError details: {str(e)}")
        return False

    except smtplib.SMTPException as e:
        print(f"\n❌ SMTP Error: {str(e)}")
        print("\nPossible issues:")
        print("  - SMTP not enabled on account")
        print("  - Firewall blocking connection")
        print("  - Incorrect server settings")
        return False

    except Exception as e:
        print(f"\n❌ Unexpected Error: {str(e)}")
        print("\nCheck your internet connection and settings")
        return False

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════╗
║     O365 SMTP Connection Test                    ║
║     FileSearch Email Configuration               ║
╚══════════════════════════════════════════════════╝
""")

    result = test_smtp_connection()

    print("\n" + "=" * 50)
    if result:
        print("✅ SUCCESS - You can now use email features!")
        print("\nNext steps:")
        print("1. Start backend: python backend/app.py")
        print("2. Start frontend: cd frontend && npm run dev")
        print("3. Test password reset feature")
    else:
        print("❌ FAILED - Please fix the issues above")
        print("\nNeed help?")
        print("1. Check .env file has correct credentials")
        print("2. Contact your IT admin for SMTP settings")
        print("3. See O365_SMTP_SETUP.md for details")
    print("=" * 50)
