# This file contains the remaining endpoints to be added to app_v2.py

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
        display_name = request.form.get('display_name', f"Store_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        description = request.form.get('description', '')

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

@app.route('/api/user/stores', methods=['GET'])
@jwt_required()
@user_required
def user_list_stores():
    """End-user: Get list of assigned stores"""
    try:
        current_user = get_current_user()

        # Get assigned stores
        assignments = db_session.query(StoreAssignment).filter_by(user_id=current_user.id).all()
        store_ids = [a.store_id for a in assignments]
        stores = db_session.query(Store).filter(Store.id.in_(store_ids)).all() if store_ids else []

        stores_list = []
        for store in stores:
            store_dict = store.to_dict()

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
