"""
Database migration script to add OTP fields to existing database
Run this if you want to keep existing data
"""

import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'backend', 'filesearch.db')

if not os.path.exists(db_path):
    print("❌ Database not found at:", db_path)
    exit(1)

print("=" * 50)
print("Database Migration: Adding OTP Fields")
print("=" * 50)
print(f"Database: {db_path}")
print()

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("🔄 Adding email_verified column...")
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0 NOT NULL")
        print("✅ Added email_verified column")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("⚠️  Column already exists, skipping")
        else:
            raise

    print("🔄 Adding otp_code column...")
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN otp_code VARCHAR(6)")
        print("✅ Added otp_code column")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("⚠️  Column already exists, skipping")
        else:
            raise

    print("🔄 Adding otp_created_at column...")
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN otp_created_at DATETIME")
        print("✅ Added otp_created_at column")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e).lower():
            print("⚠️  Column already exists, skipping")
        else:
            raise

    conn.commit()

    print()
    print("=" * 50)
    print("✅ Migration completed successfully!")
    print("=" * 50)
    print()
    print("Next steps:")
    print("1. Restart the backend: python backend/app.py")
    print("2. Refresh your browser")
    print()

except Exception as e:
    print()
    print("=" * 50)
    print("❌ Migration failed!")
    print("=" * 50)
    print(f"Error: {str(e)}")
    print()
    print("Recommendation: Delete the database and start fresh:")
    print("  del backend\\filesearch.db")
    print("  python backend/app.py")
    print()
    conn.rollback()

finally:
    conn.close()
