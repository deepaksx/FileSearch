import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from google import genai
from google.genai import types
from datetime import datetime
import tempfile
import time
from dotenv import load_dotenv

# Load environment variables from parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)
CORS(app)

# Configure Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set")

client = genai.Client(api_key=GEMINI_API_KEY)

# File upload configuration
UPLOAD_FOLDER = tempfile.mkdtemp()
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx', 'json', 'py', 'js', 'md', 'csv', 'html', 'xml'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# Store file search store information
file_search_stores = {}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})


@app.route('/api/upload', methods=['POST'])
def upload_files():
    """Upload files and create a file search store"""
    try:
        if 'files' not in request.files:
            return jsonify({"error": "No files provided"}), 400

        files = request.files.getlist('files')
        if not files or files[0].filename == '':
            return jsonify({"error": "No files selected"}), 400

        uploaded_files = []

        # Create a file search store first
        file_search_store = client.file_search_stores.create(
            config={'display_name': f"Store_{datetime.now().strftime('%Y%m%d_%H%M%S')}"}
        )
        store_id = file_search_store.name

        # Upload files directly to the store
        for file in files:
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)

                # Upload to file search store
                operation = client.file_search_stores.upload_to_file_search_store(
                    file=filepath,
                    file_search_store_name=store_id,
                    config={'display_name': filename}
                )

                # Wait for upload operation to complete
                while not operation.done:
                    time.sleep(1)
                    operation = client.operations.get(operation)

                uploaded_files.append({
                    "name": filename,
                    "display_name": filename
                })

        if not uploaded_files:
            return jsonify({"error": "No valid files uploaded"}), 400

        file_search_stores[store_id] = {
            "files": uploaded_files,
            "created_at": datetime.now().isoformat()
        }

        return jsonify({
            "success": True,
            "store_id": store_id,
            "files": uploaded_files,
            "message": f"Successfully uploaded {len(uploaded_files)} file(s)"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    """Query the file search store"""
    try:
        data = request.get_json()

        if not data or 'message' not in data or 'store_id' not in data:
            return jsonify({"error": "Missing message or store_id"}), 400

        message = data['message']
        store_id = data['store_id']
        history = data.get('history', [])  # Get conversation history from frontend

        # Build contents with conversation history
        contents = history.copy() if history else []
        # Add current user message
        contents.append({
            'role': 'user',
            'parts': [{'text': message}]
        })

        # Generate content with file search and conversation history
        response = client.models.generate_content(
            model="models/gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                tools=[types.Tool(file_search=types.FileSearch(file_search_store_names=[store_id]))]
            )
        )

        # Extract the response text
        response_text = ""
        if hasattr(response, 'text'):
            response_text = response.text
        elif hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                parts = candidate.content.parts
                response_text = " ".join([part.text for part in parts if hasattr(part, 'text')])

        # Extract citations if available
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

        return jsonify({
            "success": True,
            "response": response_text if response_text else "No response generated",
            "citations": citations
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/stores', methods=['GET'])
def list_stores():
    """List all file search stores"""
    return jsonify({
        "stores": [
            {"id": store_id, **info}
            for store_id, info in file_search_stores.items()
        ]
    })


@app.route('/api/stores/list', methods=['GET'])
def list_all_stores():
    """List all file search stores from Google Cloud"""
    try:
        stores = client.file_search_stores.list()
        store_list = []

        for store in stores:
            store_info = {
                "id": store.name,
                "display_name": store.display_name if hasattr(store, 'display_name') else store.name,
                "created_at": store.create_time.isoformat() if hasattr(store, 'create_time') else None,
                "updated_at": store.update_time.isoformat() if hasattr(store, 'update_time') else None,
            }

            # Try to get file count
            try:
                files = list(client.file_search_stores.documents.list(parent=store.name))
                store_info["file_count"] = len(files)
            except:
                store_info["file_count"] = 0

            store_list.append(store_info)

        return jsonify({
            "success": True,
            "stores": store_list
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/stores/<path:store_id>/files', methods=['GET'])
def list_store_files(store_id):
    """List files in a specific store"""
    try:
        # store_id already includes the full path like fileSearchStores/store123
        # Use documents.list with parent parameter
        files = client.file_search_stores.documents.list(parent=store_id)
        file_list = []

        for file in files:
            file_info = {
                "name": file.display_name if hasattr(file, 'display_name') else file.name,
                "full_name": file.name,
                "size": file.size_bytes if hasattr(file, 'size_bytes') else None,
                "create_time": file.create_time.isoformat() if hasattr(file, 'create_time') else None,
                "mime_type": file.mime_type if hasattr(file, 'mime_type') else None
            }
            file_list.append(file_info)

        return jsonify({
            "success": True,
            "files": file_list
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/stores/<path:store_id>', methods=['DELETE'])
def delete_store_endpoint(store_id):
    """Delete an entire store including all files"""
    try:
        # Use force=True to delete the store along with all its files
        client.file_search_stores.delete(
            name=store_id,
            config=types.DeleteFileSearchStoreConfig(force=True)
        )

        # Remove from local tracking if exists
        if store_id in file_search_stores:
            del file_search_stores[store_id]

        return jsonify({
            "success": True,
            "message": "Store and all its files deleted successfully"
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/stores/<path:store_id>/files/<path:file_name>', methods=['DELETE'])
def delete_file_endpoint(store_id, file_name):
    """Delete a specific file from a store"""
    try:
        # store_id already includes the full path
        # First, get the list of files to find the full file name
        files = client.file_search_stores.documents.list(parent=store_id)

        file_to_delete = None
        for file in files:
            # Match by display name or full name
            if (hasattr(file, 'display_name') and file.display_name == file_name) or file.name == file_name:
                file_to_delete = file.name
                break

        if not file_to_delete:
            return jsonify({"success": False, "error": "File not found"}), 404

        # Delete the document
        client.file_search_stores.documents.delete(name=file_to_delete)

        return jsonify({
            "success": True,
            "message": f"File {file_name} deleted successfully"
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
