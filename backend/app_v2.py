import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from google import genai
from google.genai import types
from datetime import datetime, timedelta
import tempfile
import time
from dotenv import load_dotenv
from sqlalchemy.orm import scoped_session
from models import init_db, get_session, User, Store, StoreAssignment, ChatSession, Message
from auth import admin_required, user_required, get_current_user

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)
CORS(app)

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
jwt = JWTManager(app)

# Gemini API Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set")

client = genai.Client(api_key=GEMINI_API_KEY)

# File upload configuration
UPLOAD_FOLDER = tempfile.mkdtemp()
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx', 'json', 'py', 'js', 'md', 'csv', 'html', 'xml'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB

# Initialize database
engine = init_db()
db_session = scoped_session(lambda: get_session(engine))

@app.teardown_appcontext
def shutdown_session(exception=None):
    db_session.remove()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ==================== AUTHENTICATION ENDPOINTS ====================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login endpoint"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400

        user = db_session.query(User).filter_by(username=username).first()

        if not user or not user.check_password(password):
            return jsonify({"error": "Invalid credentials"}), 401

        access_token = create_access_token(identity=user.id)

        return jsonify({
            "success": True,
            "access_token": access_token,
            "user": user.to_dict()
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user_info():
    """Get current user information"""
    try:
        user = get_current_user()
        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify({
            "success": True,
            "user": user.to_dict()
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== ADMIN - USER MANAGEMENT ====================

@app.route('/api/admin/users', methods=['GET'])
@jwt_required()
@admin_required
def list_users():
    """List all users"""
    try:
        users = db_session.query(User).all()
        return jsonify({
            "success": True,
            "users": [u.to_dict() for u in users]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/users', methods=['POST'])
@jwt_required()
@admin_required
def create_user():
    """Create a new user"""
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        role = data.get('role', 'user')

        if not username or not email or not password:
            return jsonify({"error": "Username, email, and password required"}), 400

        # Check if user already exists
        existing = db_session.query(User).filter(
            (User.username == username) | (User.email == email)
        ).first()

        if existing:
            return jsonify({"error": "User already exists"}), 400

        user = User(username=username, email=email, role=role)
        user.set_password(password)

        db_session.add(user)
        db_session.commit()

        return jsonify({
            "success": True,
            "user": user.to_dict()
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_user(user_id):
    """Update a user"""
    try:
        user = db_session.query(User).filter_by(id=user_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json()

        if 'username' in data:
            user.username = data['username']
        if 'email' in data:
            user.email = data['email']
        if 'role' in data:
            user.role = data['role']
        if 'password' in data:
            user.set_password(data['password'])

        db_session.commit()

        return jsonify({
            "success": True,
            "user": user.to_dict()
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_user(user_id):
    """Delete a user"""
    try:
        user = db_session.query(User).filter_by(id=user_id).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        # Don't allow deleting yourself
        current_user = get_current_user()
        if current_user.id == user_id:
            return jsonify({"error": "Cannot delete yourself"}), 400

        db_session.delete(user)
        db_session.commit()

        return jsonify({
            "success": True,
            "message": "User deleted successfully"
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


# ==================== ADMIN - STORE MANAGEMENT ====================

@app.route('/api/admin/stores', methods=['GET'])
@jwt_required()
@admin_required
def admin_list_stores():
    """Admin: List all stores"""
    try:
        stores_db = db_session.query(Store).all()

        stores_list = []
        for store in stores_db:
            store_dict = store.to_dict()

            # Get file count from Gemini
            try:
                files = list(client.file_search_stores.documents.list(parent=store.gemini_store_id))
                store_dict['file_count'] = len(files)
            except:
                store_dict['file_count'] = 0

            # Get assigned users count
            assignments_count = db_session.query(StoreAssignment).filter_by(store_id=store.id).count()
            store_dict['assigned_users'] = assignments_count

            stores_list.append(store_dict)

        return jsonify({
            "success": True,
            "stores": stores_list
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/stores/<int:store_id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_store(store_id):
    """Update store details"""
    try:
        store = db_session.query(Store).filter_by(id=store_id).first()
        if not store:
            return jsonify({"error": "Store not found"}), 404

        data = request.get_json()

        if 'display_name' in data:
            store.display_name = data['display_name']
        if 'description' in data:
            store.description = data['description']

        db_session.commit()

        return jsonify({
            "success": True,
            "store": store.to_dict()
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/stores/<int:store_id>/assign', methods=['POST'])
@jwt_required()
@admin_required
def assign_store_to_user(store_id):
    """Assign a store to a user"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')

        if not user_id:
            return jsonify({"error": "user_id required"}), 400

        store = db_session.query(Store).filter_by(id=store_id).first()
        user = db_session.query(User).filter_by(id=user_id).first()

        if not store or not user:
            return jsonify({"error": "Store or user not found"}), 404

        # Check if already assigned
        existing = db_session.query(StoreAssignment).filter_by(
            store_id=store_id, user_id=user_id
        ).first()

        if existing:
            return jsonify({"error": "Store already assigned to user"}), 400

        assignment = StoreAssignment(store_id=store_id, user_id=user_id)
        db_session.add(assignment)
        db_session.commit()

        return jsonify({
            "success": True,
            "assignment": assignment.to_dict()
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/stores/<int:store_id>/unassign/<int:user_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def unassign_store_from_user(store_id, user_id):
    """Unassign a store from a user"""
    try:
        assignment = db_session.query(StoreAssignment).filter_by(
            store_id=store_id, user_id=user_id
        ).first()

        if not assignment:
            return jsonify({"error": "Assignment not found"}), 404

        db_session.delete(assignment)
        db_session.commit()

        return jsonify({
            "success": True,
            "message": "Store unassigned successfully"
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/stores/<int:store_id>/users', methods=['GET'])
@jwt_required()
@admin_required
def get_store_users(store_id):
    """Get users assigned to a store"""
    try:
        assignments = db_session.query(StoreAssignment).filter_by(store_id=store_id).all()
        user_ids = [a.user_id for a in assignments]
        users = db_session.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []

        return jsonify({
            "success": True,
            "users": [u.to_dict() for u in users]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Continued in next message...
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
