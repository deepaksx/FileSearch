#!/usr/bin/env python
"""Initialize the database and create an admin user"""

from models import init_db, get_session, User
import sys

def create_admin_user(session, username='admin', email='admin@example.com', password='admin123'):
    """Create an admin user if it doesn't exist"""
    existing_admin = session.query(User).filter_by(username=username).first()

    if existing_admin:
        print(f"Admin user '{username}' already exists.")
        return existing_admin

    admin = User(
        username=username,
        email=email,
        role='admin'
    )
    admin.set_password(password)

    session.add(admin)
    session.commit()

    print(f"\n[OK] Admin user created successfully!")
    print(f"   Username: {username}")
    print(f"   Email: {email}")
    print(f"   Password: {password}")
    print(f"\n[WARNING] Please change the password after first login!\n")

    return admin


if __name__ == '__main__':
    print("Initializing File Search Database...")
    print("=" * 60)

    # Initialize database
    engine = init_db()
    print("[OK] Database tables created successfully!")

    # Create session
    session = get_session(engine)

    # Create admin user
    create_admin_user(session)

    session.close()
    print("=" * 60)
    print("Database initialization complete!")
