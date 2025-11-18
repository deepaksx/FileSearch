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
from auth import admin_required, user_required, get_current_user

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
    """Admin: Assign a project to a user"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')

        if not user_id:
            return jsonify({"error": "user_id required"}), 400

        project = db_session.query(Project).filter_by(id=project_id).first()
        user = db_session.query(User).filter_by(id=user_id).first()

        if not project or not user:
            return jsonify({"error": "Project or user not found"}), 404

        # Check if already assigned
        existing = db_session.query(ProjectAssignment).filter_by(
            project_id=project_id, user_id=user_id
        ).first()

        if existing:
            return jsonify({"error": "Project already assigned to user"}), 400

        assignment = ProjectAssignment(project_id=project_id, user_id=user_id)
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
    """Admin: Get users assigned to a project"""
    try:
        assignments = db_session.query(ProjectAssignment).filter_by(project_id=project_id).all()
        user_ids = [a.user_id for a in assignments]
        users = db_session.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []

        return jsonify({
            "success": True,
            "users": [u.to_dict() for u in users]
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
    """End-user: Get list of accessible projects"""
    try:
        current_user = get_current_user()

        # Get assigned projects
        project_assignments = db_session.query(ProjectAssignment).filter_by(user_id=current_user.id).all()
        project_ids = [a.project_id for a in project_assignments]
        projects = db_session.query(Project).filter(Project.id.in_(project_ids)).all() if project_ids else []

        projects_list = []
        for project in projects:
            project_dict = project.to_dict()

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
    """End-user: Get list of accessible stores (from direct assignments and project assignments)"""
    try:
        current_user = get_current_user()

        # Get directly assigned stores
        store_assignments = db_session.query(StoreAssignment).filter_by(user_id=current_user.id).all()
        directly_assigned_store_ids = [a.store_id for a in store_assignments]

        # Get project assigned stores
        project_assignments = db_session.query(ProjectAssignment).filter_by(user_id=current_user.id).all()
        assigned_project_ids = [a.project_id for a in project_assignments]
        project_stores = db_session.query(Store).filter(Store.project_id.in_(assigned_project_ids)).all() if assigned_project_ids else []
        project_store_ids = [s.id for s in project_stores]

        # Combine and deduplicate store IDs
        all_store_ids = list(set(directly_assigned_store_ids + project_store_ids))
        stores = db_session.query(Store).filter(Store.id.in_(all_store_ids)).all() if all_store_ids else []

        stores_list = []
        for store in stores:
            store_dict = store.to_dict()

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

        # Verify user has access to this store
        assignment = db_session.query(StoreAssignment).filter_by(
            store_id=store_id, user_id=current_user.id
        ).first()

        if not assignment:
            return jsonify({"error": "Access denied"}), 403

        store = db_session.query(Store).filter_by(id=store_id).first()
        if not store:
            return jsonify({"error": "Store not found"}), 404

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

        # Verify user has access to this store
        assignment = db_session.query(StoreAssignment).filter_by(
            store_id=store_id, user_id=current_user.id
        ).first()

        if not assignment:
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

        # Verify access
        assignment = db_session.query(StoreAssignment).filter_by(
            store_id=store_id, user_id=current_user.id
        ).first()

        if not assignment:
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
