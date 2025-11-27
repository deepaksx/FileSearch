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
from models import init_db, get_session, User, Project, ProjectAssignment, Store, StoreAssignment, ChatSession, Message
from auth import admin_required, user_required, get_current_user, has_owner_access
from email_utils import init_mail, send_otp_email

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*", "allow_headers": ["Content-Type", "Authorization"]}}, supports_credentials=True)

# JWT Configuration
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'
app.config['JWT_IDENTITY_CLAIM'] = 'sub'
app.config['JWT_ERROR_MESSAGE_KEY'] = 'message'
jwt = JWTManager(app)

# JWT error handlers
@jwt.invalid_token_loader
def invalid_token_callback(error_string):
    print(f"Invalid token error: {error_string}")
    return jsonify({"error": "Invalid token", "message": error_string}), 422

@jwt.unauthorized_loader
def missing_token_callback(error_string):
    print(f"Missing token error: {error_string}")
    return jsonify({"error": "Missing authorization token", "message": error_string}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_data):
    print(f"Expired token error")
    return jsonify({"error": "Token has expired"}), 401

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
from sqlalchemy.orm import sessionmaker
Session = sessionmaker(bind=engine)
db_session = scoped_session(Session)

# Initialize email
init_mail(app)

# Auto-create admin user on startup if it doesn't exist
def ensure_admin_exists():
    """Automatically create admin user if it doesn't exist"""
    try:
        session = get_session(engine)
        existing_admin = session.query(User).filter_by(username='admin').first()

        if not existing_admin:
            import bcrypt
            password_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            admin_user = User(
                username='admin',
                password_hash=password_hash,
                email='admin@filesearch.com',
                role='admin'
            )
            session.add(admin_user)
            session.commit()
            print("[OK] Admin user created automatically (username: admin, password: admin123)")
        else:
            print("[OK] Admin user already exists")

        session.close()
    except Exception as e:
        print(f"[WARNING] Admin user creation skipped: {str(e)}")

# Run admin creation check on startup
ensure_admin_exists()

@app.teardown_appcontext
def shutdown_session(exception=None):
    db_session.remove()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ==================== AUTHENTICATION ENDPOINTS ====================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login endpoint - supports username or email"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"error": "Username/email and password required"}), 400

        # Try to find user by username first, then by email
        user = db_session.query(User).filter_by(username=username).first()

        # If not found by username, try email
        if not user:
            user = db_session.query(User).filter_by(email=username).first()

        if not user or not user.check_password(password):
            return jsonify({"error": "Invalid credentials"}), 401

        # Check if email is verified (optional - can be enforced by uncommenting)
        # if not user.email_verified and user.role != 'admin':
        #     return jsonify({
        #         "error": "Email not verified",
        #         "email_verified": False,
        #         "email": user.email
        #     }), 403

        access_token = create_access_token(identity=str(user.id))

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


@app.route('/api/auth/send-verification-otp', methods=['POST'])
def send_verification_otp():
    """Send OTP to user's email for verification"""
    try:
        data = request.get_json()
        email = data.get('email')

        if not email:
            return jsonify({"error": "Email required"}), 400

        user = db_session.query(User).filter_by(email=email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        if user.email_verified:
            return jsonify({"error": "Email already verified"}), 400

        # Generate and save OTP
        otp_code = user.generate_otp()
        db_session.commit()

        # Send OTP via email
        if send_otp_email(email, otp_code, purpose='verification'):
            return jsonify({
                "success": True,
                "message": "Verification code sent to your email"
            })
        else:
            return jsonify({"error": "Failed to send email. Please try again."}), 500

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/auth/verify-email', methods=['POST'])
def verify_email():
    """Verify user's email with OTP"""
    try:
        data = request.get_json()
        email = data.get('email')
        otp_code = data.get('otp_code')

        if not email or not otp_code:
            return jsonify({"error": "Email and OTP code required"}), 400

        user = db_session.query(User).filter_by(email=email).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        if user.email_verified:
            return jsonify({"error": "Email already verified"}), 400

        # Verify OTP
        if user.verify_otp(otp_code):
            user.email_verified = True
            user.clear_otp()
            db_session.commit()

            return jsonify({
                "success": True,
                "message": "Email verified successfully"
            })
        else:
            return jsonify({"error": "Invalid or expired OTP code"}), 400

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/auth/request-password-reset', methods=['POST'])
def request_password_reset():
    """Request password reset - sends OTP to email"""
    try:
        data = request.get_json()
        email = data.get('email')

        if not email:
            return jsonify({"error": "Email required"}), 400

        user = db_session.query(User).filter_by(email=email).first()
        if not user:
            # Don't reveal if user exists or not for security
            return jsonify({
                "success": True,
                "message": "If the email exists, a reset code has been sent"
            })

        # Generate and save OTP
        otp_code = user.generate_otp()
        db_session.commit()

        # Send OTP via email
        send_otp_email(email, otp_code, purpose='reset')

        return jsonify({
            "success": True,
            "message": "If the email exists, a reset code has been sent"
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """Reset password with OTP verification"""
    try:
        data = request.get_json()
        email = data.get('email')
        otp_code = data.get('otp_code')
        new_password = data.get('new_password')

        if not email or not otp_code or not new_password:
            return jsonify({"error": "Email, OTP code, and new password required"}), 400

        if len(new_password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400

        user = db_session.query(User).filter_by(email=email).first()
        if not user:
            return jsonify({"error": "Invalid OTP code"}), 400

        # Verify OTP
        if user.verify_otp(otp_code):
            user.set_password(new_password)
            user.clear_otp()
            db_session.commit()

            return jsonify({
                "success": True,
                "message": "Password reset successfully"
            })
        else:
            return jsonify({"error": "Invalid or expired OTP code"}), 400

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


# ==================== ADMIN - USER MANAGEMENT ====================

@app.route('/api/admin/users', methods=['GET'])
@jwt_required()
@admin_required
def list_users():
    """List all users with their project and store access"""
    try:
        users = db_session.query(User).all()
        users_list = []

        for user in users:
            user_dict = user.to_dict()

            # Get project assignments for this user
            project_assignments = db_session.query(ProjectAssignment).filter_by(user_id=user.id).all()
            projects_access = []
            for pa in project_assignments:
                project = db_session.query(Project).filter_by(id=pa.project_id).first()
                if project:
                    projects_access.append({
                        'id': project.id,
                        'name': project.name,
                        'access_level': pa.access_level
                    })

            # Get store assignments for this user (direct assignments only)
            store_assignments = db_session.query(StoreAssignment).filter_by(user_id=user.id).all()
            stores_access = []
            for sa in store_assignments:
                store = db_session.query(Store).filter_by(id=sa.store_id).first()
                if store:
                    stores_access.append({
                        'id': store.id,
                        'name': store.display_name,
                        'access_level': sa.access_level
                    })

            user_dict['projects_access'] = projects_access
            user_dict['stores_access'] = stores_access
            users_list.append(user_dict)

        return jsonify({
            "success": True,
            "users": users_list
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


# ==================== ADMIN - PROJECT MANAGEMENT ====================

@app.route('/api/admin/projects', methods=['GET'])
@jwt_required()
@admin_required
def admin_list_projects():
    """Admin: List all projects"""
    try:
        projects_db = db_session.query(Project).all()

        projects_list = []
        for project in projects_db:
            project_dict = project.to_dict()

            # Get store count
            store_count = db_session.query(Store).filter_by(project_id=project.id).count()
            project_dict['store_count'] = store_count

            # Get assigned users count
            assignments_count = db_session.query(ProjectAssignment).filter_by(project_id=project.id).count()
            project_dict['assigned_users'] = assignments_count

            projects_list.append(project_dict)

        return jsonify({
            "success": True,
            "projects": projects_list
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/projects', methods=['POST'])
@jwt_required()
@admin_required
def create_project():
    """Admin: Create a new project"""
    try:
        data = request.get_json()
        name = data.get('name')
        description = data.get('description', '')

        if not name:
            return jsonify({"error": "Project name required"}), 400

        current_user = get_current_user()
        project = Project(
            name=name,
            description=description,
            created_by=current_user.id
        )

        db_session.add(project)
        db_session.commit()

        return jsonify({
            "success": True,
            "project": project.to_dict()
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/projects/<int:project_id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_project(project_id):
    """Admin: Update a project"""
    try:
        project = db_session.query(Project).filter_by(id=project_id).first()
        if not project:
            return jsonify({"error": "Project not found"}), 404

        data = request.get_json()

        if 'name' in data:
            project.name = data['name']
        if 'description' in data:
            project.description = data['description']

        db_session.commit()

        return jsonify({
            "success": True,
            "project": project.to_dict()
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/projects/<int:project_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_project(project_id):
    """Admin: Delete a project"""
    try:
        project = db_session.query(Project).filter_by(id=project_id).first()
        if not project:
            return jsonify({"error": "Project not found"}), 404

        # Delete project (cascades to stores, sessions, etc.)
        db_session.delete(project)
        db_session.commit()

        return jsonify({
            "success": True,
            "message": "Project deleted successfully"
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/projects/<int:project_id>/assign', methods=['POST'])
@jwt_required()
@admin_required
def assign_project_to_user(project_id):
    """Admin: Assign a project to a user with access level (user/owner)"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        access_level = data.get('access_level', 'user')  # Default to 'user' (view only)

        if not user_id:
            return jsonify({"error": "user_id required"}), 400

        if access_level not in ['user', 'owner']:
            return jsonify({"error": "access_level must be 'user' or 'owner'"}), 400

        project = db_session.query(Project).filter_by(id=project_id).first()
        user = db_session.query(User).filter_by(id=user_id).first()

        if not project or not user:
            return jsonify({"error": "Project or user not found"}), 404

        # Check if already assigned
        existing = db_session.query(ProjectAssignment).filter_by(
            project_id=project_id, user_id=user_id
        ).first()

        if existing:
            # Update access level if already assigned
            existing.access_level = access_level
            db_session.commit()
            return jsonify({
                "success": True,
                "message": "Access level updated",
                "assignment": existing.to_dict()
            })

        assignment = ProjectAssignment(project_id=project_id, user_id=user_id, access_level=access_level)
        db_session.add(assignment)
        db_session.commit()

        return jsonify({
            "success": True,
            "assignment": assignment.to_dict()
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/projects/<int:project_id>/unassign/<int:user_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def unassign_project_from_user(project_id, user_id):
    """Admin: Unassign a project from a user"""
    try:
        assignment = db_session.query(ProjectAssignment).filter_by(
            project_id=project_id, user_id=user_id
        ).first()

        if not assignment:
            return jsonify({"error": "Assignment not found"}), 404

        db_session.delete(assignment)
        db_session.commit()

        return jsonify({
            "success": True,
            "message": "Project unassigned successfully"
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/projects/<int:project_id>/users', methods=['GET'])
@jwt_required()
@admin_required
def get_project_users(project_id):
    """Admin: Get users assigned to a project with their access levels"""
    try:
        assignments = db_session.query(ProjectAssignment).filter_by(project_id=project_id).all()

        # Include access level for each user
        users_with_access = []
        for assignment in assignments:
            user = db_session.query(User).filter_by(id=assignment.user_id).first()
            if user:
                user_dict = user.to_dict()
                user_dict['access_level'] = assignment.access_level
                users_with_access.append(user_dict)

        return jsonify({
            "success": True,
            "users": users_with_access
        })

    except Exception as e:
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


@app.route('/api/admin/projects/<int:project_id>/stores', methods=['GET'])
@jwt_required()
@admin_required
def admin_list_project_stores(project_id):
    """Admin: List all stores in a project"""
    try:
        # Verify project exists
        project = db_session.query(Project).filter_by(id=project_id).first()
        if not project:
            return jsonify({"error": "Project not found"}), 404

        stores_db = db_session.query(Store).filter_by(project_id=project_id).all()

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


@app.route('/api/admin/stores/<int:store_id>', methods=['GET'])
@jwt_required()
@admin_required
def get_store(store_id):
    """Get a single store's details"""
    try:
        store = db_session.query(Store).filter_by(id=store_id).first()
        if not store:
            return jsonify({"error": "Store not found"}), 404

        return jsonify({
            "success": True,
            "store": store.to_dict()
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
    """Assign a store to a user with access level (user/owner)"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        access_level = data.get('access_level', 'user')  # Default to 'user' (view only)

        if not user_id:
            return jsonify({"error": "user_id required"}), 400

        if access_level not in ['user', 'owner']:
            return jsonify({"error": "access_level must be 'user' or 'owner'"}), 400

        store = db_session.query(Store).filter_by(id=store_id).first()
        user = db_session.query(User).filter_by(id=user_id).first()

        if not store or not user:
            return jsonify({"error": "Store or user not found"}), 404

        # Check if already assigned
        existing = db_session.query(StoreAssignment).filter_by(
            store_id=store_id, user_id=user_id
        ).first()

        if existing:
            # Update access level if already assigned
            existing.access_level = access_level
            db_session.commit()
            return jsonify({
                "success": True,
                "message": "Access level updated",
                "assignment": existing.to_dict()
            })

        assignment = StoreAssignment(store_id=store_id, user_id=user_id, access_level=access_level)
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
    """Get users assigned to a store with their access levels"""
    try:
        assignments = db_session.query(StoreAssignment).filter_by(store_id=store_id).all()

        # Include access level for each user
        users_with_access = []
        for assignment in assignments:
            user = db_session.query(User).filter_by(id=assignment.user_id).first()
            if user:
                user_dict = user.to_dict()
                user_dict['access_level'] = assignment.access_level
                users_with_access.append(user_dict)

        return jsonify({
            "success": True,
            "users": users_with_access
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== ADMIN - FILE UPLOAD ====================

@app.route('/api/admin/upload', methods=['POST'])
@jwt_required()
@admin_required
def admin_upload_files():
    """Admin: Upload files and create a store"""
    try:
        if 'files' not in request.files:
            return jsonify({"error": "No files provided"}), 400

        files = request.files.getlist('files')
        project_id = request.form.get('project_id')
        display_name = request.form.get('display_name', f"Store_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        description = request.form.get('description', '')

        if not project_id:
            return jsonify({"error": "project_id required"}), 400

        # Verify project exists
        project = db_session.query(Project).filter_by(id=project_id).first()
        if not project:
            return jsonify({"error": "Project not found"}), 404

        if not files or files[0].filename == '':
            return jsonify({"error": "No files selected"}), 400

        uploaded_files = []

        # Create Gemini file search store
        file_search_store = client.file_search_stores.create(
            config={'display_name': display_name}
        )
        gemini_store_id = file_search_store.name

        # Upload files to store
        for file in files:
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)

                operation = client.file_search_stores.upload_to_file_search_store(
                    file=filepath,
                    file_search_store_name=gemini_store_id,
                    config={'display_name': filename}
                )

                while not operation.done:
                    time.sleep(1)
                    operation = client.operations.get(operation)

                uploaded_files.append({"name": filename})

        if not uploaded_files:
            return jsonify({"error": "No valid files uploaded"}), 400

        # Save to database
        current_user = get_current_user()
        store = Store(
            project_id=project_id,
            gemini_store_id=gemini_store_id,
            display_name=display_name,
            description=description,
            created_by=current_user.id
        )

        db_session.add(store)
        db_session.commit()

        return jsonify({
            "success": True,
            "store": store.to_dict(),
            "files": uploaded_files,
            "message": f"Successfully uploaded {len(uploaded_files)} file(s)"
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/stores/<int:store_id>/upload', methods=['POST'])
@jwt_required()
@admin_required
def admin_upload_files_to_store(store_id):
    """Admin: Upload additional files to an existing store"""
    try:
        # Check if store exists
        store = db_session.query(Store).filter_by(id=store_id).first()
        if not store:
            return jsonify({"error": "Store not found"}), 404

        if 'files' not in request.files:
            return jsonify({"error": "No files provided"}), 400

        files = request.files.getlist('files')

        if not files or files[0].filename == '':
            return jsonify({"error": "No files selected"}), 400

        uploaded_files = []

        # Upload files to existing store
        for file in files:
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)

                operation = client.file_search_stores.upload_to_file_search_store(
                    file=filepath,
                    file_search_store_name=store.gemini_store_id,
                    config={'display_name': filename}
                )

                while not operation.done:
                    time.sleep(1)
                    operation = client.operations.get(operation)

                uploaded_files.append({"name": filename})

        if not uploaded_files:
            return jsonify({"error": "No valid files uploaded"}), 400

        return jsonify({
            "success": True,
            "store": store.to_dict(),
            "files": uploaded_files,
            "message": f"Successfully uploaded {len(uploaded_files)} file(s) to {store.display_name}"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/stores/<int:store_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def admin_delete_store(store_id):
    """Admin: Delete a store"""
    try:
        store = db_session.query(Store).filter_by(id=store_id).first()
        if not store:
            return jsonify({"error": "Store not found"}), 404

        # Delete from Gemini
        try:
            client.file_search_stores.delete(
                name=store.gemini_store_id,
                config=types.DeleteFileSearchStoreConfig(force=True)
            )
        except Exception as gemini_error:
            print(f"Error deleting from Gemini: {gemini_error}")

        # Delete from database (cascades to assignments and sessions)
        db_session.delete(store)
        db_session.commit()

        return jsonify({
            "success": True,
            "message": "Store deleted successfully"
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


# ==================== END-USER ENDPOINTS ====================

@app.route('/api/user/projects', methods=['GET'])
@jwt_required()
@user_required
def user_list_projects():
    """End-user: Get list of accessible projects with access levels"""
    try:
        current_user = get_current_user()

        # Get assigned projects
        project_assignments = db_session.query(ProjectAssignment).filter_by(user_id=current_user.id).all()

        # Create a map of project_id to access_level
        access_map = {a.project_id: a.access_level for a in project_assignments}
        project_ids = list(access_map.keys())
        projects = db_session.query(Project).filter(Project.id.in_(project_ids)).all() if project_ids else []

        projects_list = []
        for project in projects:
            project_dict = project.to_dict()

            # Include user's access level for this project
            project_dict['access_level'] = access_map.get(project.id, 'user')

            # Get store count
            store_count = db_session.query(Store).filter_by(project_id=project.id).count()
            project_dict['store_count'] = store_count

            projects_list.append(project_dict)

        return jsonify({
            "success": True,
            "projects": projects_list
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/user/stores', methods=['GET'])
@jwt_required()
@user_required
def user_list_stores():
    """End-user: Get list of accessible stores with access levels"""
    try:
        current_user = get_current_user()

        # Get directly assigned stores with access levels
        store_assignments = db_session.query(StoreAssignment).filter_by(user_id=current_user.id).all()
        direct_store_access = {a.store_id: a.access_level for a in store_assignments}
        directly_assigned_store_ids = list(direct_store_access.keys())

        # Get project assigned stores with access levels
        project_assignments = db_session.query(ProjectAssignment).filter_by(user_id=current_user.id).all()
        project_access = {a.project_id: a.access_level for a in project_assignments}
        assigned_project_ids = list(project_access.keys())
        project_stores = db_session.query(Store).filter(Store.project_id.in_(assigned_project_ids)).all() if assigned_project_ids else []
        project_store_ids = [s.id for s in project_stores]

        # Combine and deduplicate store IDs
        all_store_ids = list(set(directly_assigned_store_ids + project_store_ids))
        stores = db_session.query(Store).filter(Store.id.in_(all_store_ids)).all() if all_store_ids else []

        stores_list = []
        for store in stores:
            store_dict = store.to_dict()

            # Determine effective access level (direct assignment takes precedence, or project level)
            store_direct_access = direct_store_access.get(store.id)
            project_level_access = project_access.get(store.project_id)

            # If both exist, choose 'owner' if either is owner, otherwise 'user'
            if store_direct_access and project_level_access:
                effective_access = 'owner' if (store_direct_access == 'owner' or project_level_access == 'owner') else 'user'
            else:
                effective_access = store_direct_access or project_level_access or 'user'

            store_dict['access_level'] = effective_access

            # Get project info
            project = db_session.query(Project).filter_by(id=store.project_id).first()
            store_dict['project_name'] = project.name if project else None

            # Get file count
            try:
                files = list(client.file_search_stores.documents.list(parent=store.gemini_store_id))
                store_dict['file_count'] = len(files)
            except:
                store_dict['file_count'] = 0

            # Get session count for this user
            sessions_count = db_session.query(ChatSession).filter_by(
                store_id=store.id, user_id=current_user.id
            ).count()
            store_dict['session_count'] = sessions_count

            stores_list.append(store_dict)

        return jsonify({
            "success": True,
            "stores": stores_list
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/user/stores/<int:store_id>/files', methods=['GET'])
@jwt_required()
@user_required
def user_list_store_files(store_id):
    """End-user: Get list of files in a store"""
    try:
        current_user = get_current_user()

        # Get store first
        store = db_session.query(Store).filter_by(id=store_id).first()
        if not store:
            return jsonify({"error": "Store not found"}), 404

        # Verify user has access to this store (admins have access to all stores)
        if current_user.role != 'admin':
            store_assignment = db_session.query(StoreAssignment).filter_by(
                store_id=store_id, user_id=current_user.id
            ).first()

            project_assignment = db_session.query(ProjectAssignment).filter_by(
                project_id=store.project_id, user_id=current_user.id
            ).first()

            if not store_assignment and not project_assignment:
                return jsonify({"error": "Access denied"}), 403

        # Get files from Gemini
        try:
            files = list(client.file_search_stores.documents.list(parent=store.gemini_store_id))
            files_list = []
            for file in files:
                files_list.append({
                    'name': file.display_name if hasattr(file, 'display_name') else file.name,
                    'id': file.name,
                    'created_at': file.create_time.isoformat() if hasattr(file, 'create_time') else None
                })

            return jsonify({
                "success": True,
                "files": files_list
            })
        except Exception as e:
            return jsonify({"error": f"Failed to retrieve files: {str(e)}"}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/user/stores/<int:store_id>/sessions', methods=['GET'])
@jwt_required()
@user_required
def user_list_sessions(store_id):
    """End-user: List chat sessions for a store"""
    try:
        current_user = get_current_user()

        # Verify user has access to this store (admins have access to all stores)
        store = db_session.query(Store).filter_by(id=store_id).first()
        if not store:
            return jsonify({"error": "Store not found"}), 404

        if current_user.role != 'admin':
            store_assignment = db_session.query(StoreAssignment).filter_by(
                store_id=store_id, user_id=current_user.id
            ).first()

            project_assignment = db_session.query(ProjectAssignment).filter_by(
                project_id=store.project_id, user_id=current_user.id
            ).first()

            if not store_assignment and not project_assignment:
                return jsonify({"error": "Access denied"}), 403

        sessions = db_session.query(ChatSession).filter_by(
            store_id=store_id, user_id=current_user.id
        ).order_by(ChatSession.last_message_at.desc()).all()

        return jsonify({
            "success": True,
            "sessions": [s.to_dict() for s in sessions]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/user/stores/<int:store_id>/sessions', methods=['POST'])
@jwt_required()
@user_required
def user_create_session(store_id):
    """End-user: Create a new chat session"""
    try:
        current_user = get_current_user()
        data = request.get_json()
        session_name = data.get('session_name', f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}")

        # Verify access (admins have access to all stores)
        store = db_session.query(Store).filter_by(id=store_id).first()
        if not store:
            return jsonify({"error": "Store not found"}), 404

        if current_user.role != 'admin':
            # Check direct store assignment
            store_assignment = db_session.query(StoreAssignment).filter_by(
                store_id=store_id, user_id=current_user.id
            ).first()

            # Check project-level assignment
            project_assignment = db_session.query(ProjectAssignment).filter_by(
                project_id=store.project_id, user_id=current_user.id
            ).first()

            if not store_assignment and not project_assignment:
                return jsonify({"error": "Access denied"}), 403

        session = ChatSession(
            store_id=store_id,
            user_id=current_user.id,
            session_name=session_name
        )

        db_session.add(session)
        db_session.commit()

        return jsonify({
            "success": True,
            "session": session.to_dict()
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/user/sessions/<int:session_id>', methods=['DELETE'])
@jwt_required()
@user_required
def user_delete_session(session_id):
    """End-user: Delete a chat session"""
    try:
        current_user = get_current_user()
        session = db_session.query(ChatSession).filter_by(
            id=session_id, user_id=current_user.id
        ).first()

        if not session:
            return jsonify({"error": "Session not found"}), 404

        db_session.delete(session)
        db_session.commit()

        return jsonify({
            "success": True,
            "message": "Session deleted successfully"
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/user/sessions/<int:session_id>/messages', methods=['GET'])
@jwt_required()
@user_required
def user_get_messages(session_id):
    """End-user: Get messages for a session"""
    try:
        current_user = get_current_user()
        session = db_session.query(ChatSession).filter_by(
            id=session_id, user_id=current_user.id
        ).first()

        if not session:
            return jsonify({"error": "Session not found"}), 404

        messages = db_session.query(Message).filter_by(
            session_id=session_id
        ).order_by(Message.timestamp).all()

        return jsonify({
            "success": True,
            "messages": [m.to_dict() for m in messages]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/user/sessions/<int:session_id>/chat', methods=['POST'])
@jwt_required()
@user_required
def user_chat(session_id):
    """End-user: Send a message in a session"""
    try:
        current_user = get_current_user()
        data = request.get_json()
        message_content = data.get('message')

        if not message_content:
            return jsonify({"error": "Message required"}), 400

        session = db_session.query(ChatSession).filter_by(
            id=session_id, user_id=current_user.id
        ).first()

        if not session:
            return jsonify({"error": "Session not found"}), 404

        # Get store
        store = db_session.query(Store).filter_by(id=session.store_id).first()

        # Save user message
        user_message = Message(
            session_id=session_id,
            role='user',
            content=message_content
        )
        db_session.add(user_message)

        # Build conversation history from this session
        previous_messages = db_session.query(Message).filter_by(
            session_id=session_id
        ).order_by(Message.timestamp).all()

        history = []
        for msg in previous_messages:
            history.append({
                'role': 'model' if msg.role == 'assistant' else 'user',
                'parts': [{'text': msg.content}]
            })

        # Add current message
        contents = history + [{
            'role': 'user',
            'parts': [{'text': message_content}]
        }]

        # Query Gemini
        response = client.models.generate_content(
            model="models/gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                tools=[types.Tool(file_search=types.FileSearch(
                    file_search_store_names=[store.gemini_store_id]
                ))]
            )
        )

        # Extract response
        response_text = ""
        if hasattr(response, 'text'):
            response_text = response.text
        elif hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                parts = candidate.content.parts
                response_text = " ".join([part.text for part in parts if hasattr(part, 'text')])

        # Extract citations
        citations = []
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'grounding_metadata'):
                metadata = candidate.grounding_metadata
                if hasattr(metadata, 'grounding_chunks'):
                    for chunk in metadata.grounding_chunks:
                        if hasattr(chunk, 'retrieved_context'):
                            citations.append({
                                "uri": chunk.retrieved_context.uri,
                                "title": chunk.retrieved_context.title
                            })

        # Save assistant message
        assistant_message = Message(
            session_id=session_id,
            role='assistant',
            content=response_text if response_text else "No response generated",
            citations=json.dumps(citations) if citations else None
        )
        db_session.add(assistant_message)

        # Update session last message time
        session.last_message_at = datetime.utcnow()

        db_session.commit()

        return jsonify({
            "success": True,
            "message": assistant_message.to_dict()
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


# ==================== OWNER ENDPOINTS (Edit Store Files) ====================

@app.route('/api/owner/stores/<int:store_id>/upload', methods=['POST'])
@jwt_required()
@user_required
def owner_upload_files_to_store(store_id):
    """Owner/Admin: Upload files to a store"""
    try:
        current_user = get_current_user()

        # Check if user is admin or has owner access to this store
        if current_user.role != 'admin' and not has_owner_access(current_user.id, store_id):
            return jsonify({"error": "Owner or admin access required"}), 403

        # Check if store exists
        store = db_session.query(Store).filter_by(id=store_id).first()
        if not store:
            return jsonify({"error": "Store not found"}), 404

        if 'files' not in request.files:
            return jsonify({"error": "No files provided"}), 400

        files = request.files.getlist('files')

        if not files or files[0].filename == '':
            return jsonify({"error": "No files selected"}), 400

        uploaded_files = []

        # Upload files to existing store
        for file in files:
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)

                operation = client.file_search_stores.upload_to_file_search_store(
                    file=filepath,
                    file_search_store_name=store.gemini_store_id,
                    config={'display_name': filename}
                )

                while not operation.done:
                    time.sleep(1)
                    operation = client.operations.get(operation)

                uploaded_files.append({"name": filename})

        if not uploaded_files:
            return jsonify({"error": "No valid files uploaded"}), 400

        return jsonify({
            "success": True,
            "store": store.to_dict(),
            "files": uploaded_files,
            "message": f"Successfully uploaded {len(uploaded_files)} file(s) to {store.display_name}"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/owner/stores/<int:store_id>/files/<path:file_id>', methods=['DELETE'])
@jwt_required()
@user_required
def owner_delete_file_from_store(store_id, file_id):
    """Owner/Admin: Delete a file from a store"""
    try:
        current_user = get_current_user()

        # Check if user is admin or has owner access to this store
        if current_user.role != 'admin' and not has_owner_access(current_user.id, store_id):
            return jsonify({"error": "Owner or admin access required"}), 403

        # Check if store exists
        store = db_session.query(Store).filter_by(id=store_id).first()
        if not store:
            return jsonify({"error": "Store not found"}), 404

        # Delete file from Gemini
        try:
            client.file_search_stores.documents.delete(name=file_id)
            return jsonify({
                "success": True,
                "message": "File deleted successfully"
            })
        except Exception as e:
            error_msg = str(e)
            # Check if it's the "non-empty document" error
            if "non-empty" in error_msg.lower() or "FAILED_PRECONDITION" in error_msg:
                return jsonify({
                    "error": "Google Gemini File Search API does not currently support deleting individual documents from a store. To remove files, you'll need to delete and recreate the entire store."
                }), 400
            else:
                return jsonify({"error": f"Failed to delete file: {error_msg}"}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==================== GEMINI STORE MANAGER ====================

@app.route('/api/admin/gemini-stores', methods=['GET'])
@jwt_required()
@admin_required
def list_all_gemini_stores():
    """Admin: List all Gemini file search stores from Google account"""
    try:
        # Get all stores from Gemini API
        gemini_stores = list(client.file_search_stores.list())

        # Get all stores from our database to check which are imported
        db_stores = db_session.query(Store).all()
        imported_store_ids = {s.gemini_store_id for s in db_stores}

        # Build response
        stores_list = []
        for store in gemini_stores:
            store_id = store.name

            # Get file count
            try:
                files = list(client.file_search_stores.documents.list(parent=store_id))
                file_count = len(files)
            except:
                file_count = 0

            # Check if imported in our database
            is_imported = store_id in imported_store_ids
            db_store = None
            if is_imported:
                db_store = db_session.query(Store).filter_by(gemini_store_id=store_id).first()

            stores_list.append({
                'gemini_store_id': store_id,
                'display_name': store.display_name if hasattr(store, 'display_name') else store_id,
                'file_count': file_count,
                'is_imported': is_imported,
                'db_store_id': db_store.id if db_store else None,
                'db_display_name': db_store.display_name if db_store else None,
                'db_project_id': db_store.project_id if db_store else None,
                'create_time': store.create_time.isoformat() if hasattr(store, 'create_time') and store.create_time else None
            })

        return jsonify({
            "success": True,
            "stores": stores_list,
            "total": len(stores_list),
            "imported": len([s for s in stores_list if s['is_imported']]),
            "orphaned": len([s for s in stores_list if not s['is_imported']])
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/gemini-stores/<path:gemini_store_id>/files', methods=['GET'])
@jwt_required()
@admin_required
def get_gemini_store_files(gemini_store_id):
    """Admin: Get files in a Gemini store"""
    try:
        files = list(client.file_search_stores.documents.list(parent=gemini_store_id))

        files_list = []
        for file in files:
            files_list.append({
                'id': file.name,
                'display_name': file.display_name if hasattr(file, 'display_name') else file.name,
                'create_time': file.create_time.isoformat() if hasattr(file, 'create_time') and file.create_time else None
            })

        return jsonify({
            "success": True,
            "files": files_list,
            "total": len(files_list)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/gemini-stores/import', methods=['POST'])
@jwt_required()
@admin_required
def import_gemini_store():
    """Admin: Import an existing Gemini store into the database"""
    try:
        data = request.get_json()
        gemini_store_id = data.get('gemini_store_id')
        project_id = data.get('project_id')
        display_name = data.get('display_name')
        description = data.get('description', '')

        if not gemini_store_id or not project_id or not display_name:
            return jsonify({"error": "gemini_store_id, project_id, and display_name required"}), 400

        # Verify project exists
        project = db_session.query(Project).filter_by(id=project_id).first()
        if not project:
            return jsonify({"error": "Project not found"}), 404

        # Check if already imported
        existing = db_session.query(Store).filter_by(gemini_store_id=gemini_store_id).first()
        if existing:
            return jsonify({"error": "This Gemini store is already imported"}), 400

        # Verify the Gemini store exists
        try:
            gemini_store = client.file_search_stores.get(name=gemini_store_id)
        except Exception as e:
            return jsonify({"error": f"Gemini store not found: {str(e)}"}), 404

        # Create database entry
        current_user = get_current_user()
        store = Store(
            project_id=project_id,
            gemini_store_id=gemini_store_id,
            display_name=display_name,
            description=description,
            created_by=current_user.id
        )

        db_session.add(store)
        db_session.commit()

        return jsonify({
            "success": True,
            "store": store.to_dict(),
            "message": f"Successfully imported Gemini store as '{display_name}'"
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


@app.route('/api/admin/gemini-stores/<path:gemini_store_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_gemini_store(gemini_store_id):
    """Admin: Delete a Gemini store from Google (and database if imported)"""
    try:
        # Check if it's in our database
        db_store = db_session.query(Store).filter_by(gemini_store_id=gemini_store_id).first()

        # Delete from Gemini
        try:
            client.file_search_stores.delete(
                name=gemini_store_id,
                config=types.DeleteFileSearchStoreConfig(force=True)
            )
        except Exception as gemini_error:
            return jsonify({"error": f"Failed to delete from Gemini: {str(gemini_error)}"}), 500

        # Delete from database if exists
        if db_store:
            db_session.delete(db_store)
            db_session.commit()

        return jsonify({
            "success": True,
            "message": "Gemini store deleted successfully",
            "was_imported": db_store is not None
        })

    except Exception as e:
        db_session.rollback()
        return jsonify({"error": str(e)}), 500


# ==================== HEALTH CHECK ====================

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})


@app.route('/api/init-admin', methods=['POST'])
def init_admin():
    """Initialize admin user - call this once after deployment"""
    session = get_session(engine)
    try:
        # Check if admin user already exists
        existing_admin = session.query(User).filter_by(username='admin').first()

        if existing_admin:
            return jsonify({
                "status": "info",
                "message": "Admin user already exists. No action needed."
            }), 200

        # Create admin user
        import bcrypt
        password_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin_user = User(
            username='admin',
            password_hash=password_hash,
            email='admin@filesearch.com',
            role='admin'
        )

        session.add(admin_user)
        session.commit()

        return jsonify({
            "status": "success",
            "message": "Admin user created successfully!",
            "credentials": {
                "username": "admin",
                "password": "admin123"
            },
            "warning": "Please change the password after first login!"
        }), 201

    except Exception as e:
        session.rollback()
        return jsonify({
            "status": "error",
            "message": f"Failed to create admin user: {str(e)}"
        }), 500
    finally:
        session.close()


# ==================== RUN SERVER ====================

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
