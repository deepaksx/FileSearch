from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import bcrypt
import os

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    role = Column(String(20), nullable=False, default='user')  # 'admin' or 'user'
    email_verified = Column(Boolean, default=False, nullable=False)
    otp_code = Column(String(6), nullable=True)
    otp_created_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    sessions = relationship('ChatSession', back_populates='user', cascade='all, delete-orphan')
    store_assignments = relationship('StoreAssignment', back_populates='user', cascade='all, delete-orphan')
    project_assignments = relationship('ProjectAssignment', back_populates='user', cascade='all, delete-orphan')

    def set_password(self, password):
        """Hash and set the password"""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def check_password(self, password):
        """Check if the provided password matches the hash"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

    def generate_otp(self):
        """Generate a 6-digit OTP and set expiry"""
        import random
        self.otp_code = str(random.randint(100000, 999999))
        self.otp_created_at = datetime.utcnow()
        return self.otp_code

    def verify_otp(self, otp_code):
        """Verify OTP code and check if it's still valid (15 minutes)"""
        if not self.otp_code or not self.otp_created_at:
            return False

        # Check if OTP matches
        if self.otp_code != otp_code:
            return False

        # Check if OTP is still valid (15 minutes)
        from datetime import timedelta
        if datetime.utcnow() - self.otp_created_at > timedelta(minutes=15):
            return False

        return True

    def clear_otp(self):
        """Clear OTP after successful verification"""
        self.otp_code = None
        self.otp_created_at = None

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'email_verified': self.email_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Project(Base):
    __tablename__ = 'projects'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    creator = relationship('User', foreign_keys=[created_by])
    stores = relationship('Store', back_populates='project', cascade='all, delete-orphan')
    assignments = relationship('ProjectAssignment', back_populates='project', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Store(Base):
    __tablename__ = 'stores'

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=False)
    gemini_store_id = Column(String(255), unique=True, nullable=False)  # The actual Gemini API store ID
    display_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship('Project', back_populates='stores')
    creator = relationship('User', foreign_keys=[created_by])
    assignments = relationship('StoreAssignment', back_populates='store', cascade='all, delete-orphan')
    sessions = relationship('ChatSession', back_populates='store', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'gemini_store_id': self.gemini_store_id,
            'display_name': self.display_name,
            'description': self.description,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class StoreAssignment(Base):
    __tablename__ = 'store_assignments'

    id = Column(Integer, primary_key=True)
    store_id = Column(Integer, ForeignKey('stores.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    access_level = Column(String(20), nullable=False, default='user')  # 'user' (view) or 'owner' (edit)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    store = relationship('Store', back_populates='assignments')
    user = relationship('User', back_populates='store_assignments')

    def to_dict(self):
        return {
            'id': self.id,
            'store_id': self.store_id,
            'user_id': self.user_id,
            'access_level': self.access_level,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None
        }


class ProjectAssignment(Base):
    __tablename__ = 'project_assignments'

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey('projects.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    access_level = Column(String(20), nullable=False, default='user')  # 'user' (view) or 'owner' (edit)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    project = relationship('Project', back_populates='assignments')
    user = relationship('User', back_populates='project_assignments')

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'user_id': self.user_id,
            'access_level': self.access_level,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None
        }


class ChatSession(Base):
    __tablename__ = 'chat_sessions'

    id = Column(Integer, primary_key=True)
    store_id = Column(Integer, ForeignKey('stores.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    session_name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_message_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    store = relationship('Store', back_populates='sessions')
    user = relationship('User', back_populates='sessions')
    messages = relationship('Message', back_populates='session', cascade='all, delete-orphan', order_by='Message.timestamp')

    def to_dict(self):
        return {
            'id': self.id,
            'store_id': self.store_id,
            'user_id': self.user_id,
            'session_name': self.session_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None
        }


class Message(Base):
    __tablename__ = 'messages'

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('chat_sessions.id'), nullable=False)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    citations = Column(Text, nullable=True)  # JSON string
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship('ChatSession', back_populates='messages')

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'session_id': self.session_id,
            'role': self.role,
            'content': self.content,
            'citations': json.loads(self.citations) if self.citations else [],
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }


# Database initialization
def init_db(database_url=None):
    """Initialize the database"""
    # Use DATABASE_URL from environment if available, otherwise default to SQLite
    if database_url is None:
        database_url = os.getenv('DATABASE_URL', 'sqlite:///filesearch.db')

    # Handle Render's postgres:// URL format (convert to postgresql://)
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)

    engine = create_engine(
        database_url,
        echo=False,
        pool_size=20,
        max_overflow=40,
        pool_recycle=3600,
        pool_pre_ping=True
    )
    Base.metadata.create_all(engine)
    return engine


def get_session(engine):
    """Get a database session"""
    Session = sessionmaker(bind=engine)
    return Session()
