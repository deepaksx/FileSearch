"""Authentication utilities and middleware"""
from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from models import get_session, User
import os

def admin_required(fn):
    """Decorator to require admin role"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        current_user_id = int(get_jwt_identity())

        # Get database session
        from app import db_session
        user = db_session.query(User).filter_by(id=current_user_id).first()

        if not user or user.role != 'admin':
            return jsonify({"error": "Admin access required"}), 403

        return fn(*args, **kwargs)
    return wrapper


def user_required(fn):
    """Decorator to require any authenticated user"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        current_user_id = int(get_jwt_identity())

        # Get database session
        from app import db_session
        user = db_session.query(User).filter_by(id=current_user_id).first()

        if not user:
            return jsonify({"error": "Authentication required"}), 401

        return fn(*args, **kwargs)
    return wrapper


def get_current_user():
    """Get the current authenticated user"""
    current_user_id = int(get_jwt_identity())
    from app import db_session
    return db_session.query(User).filter_by(id=current_user_id).first()
