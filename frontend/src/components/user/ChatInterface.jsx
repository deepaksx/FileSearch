import { useState, useEffect, useRef } from 'react';
import {
  getStoreSessions,
  createSession,
  deleteSession,
  getSessionMessages,
  sendMessage,
  getStoreFiles,
  ownerUploadFiles,
  ownerDeleteFile
} from '../../utils/api';
import './ChatInterface.css';

// Function to format message content with better HTML rendering
const formatMessageContent = (content) => {
  if (!content) return '';

  // First, split content into paragraphs
  let lines = content.split('\n');
  let formatted = '';
  let inList = false;
  let listItems = [];
  let listType = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (!line) {
      // Empty line - close any open list and add paragraph break
      if (inList) {
        formatted += listType === 'ol'
          ? '<ol>' + listItems.join('') + '</ol>'
          : '<ul>' + listItems.join('') + '</ul>';
        inList = false;
        listItems = [];
        listType = null;
      }
      formatted += '<div class="paragraph-break"></div>';
      continue;
    }

    // Check for numbered list
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) {
          formatted += '<ul>' + listItems.join('') + '</ul>';
          listItems = [];
        }
        inList = true;
        listType = 'ol';
      }
      listItems.push('<li>' + formatInlineStyles(numberedMatch[2]) + '</li>');
      continue;
    }

    // Check for bullet list
    const bulletMatch = line.match(/^[\*\-]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) {
          formatted += '<ol>' + listItems.join('') + '</ol>';
          listItems = [];
        }
        inList = true;
        listType = 'ul';
      }
      listItems.push('<li>' + formatInlineStyles(bulletMatch[1]) + '</li>');
      continue;
    }

    // Check for headers
    const h1Match = line.match(/^#\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

    if (h3Match) {
      if (inList) {
        formatted += listType === 'ol'
          ? '<ol>' + listItems.join('') + '</ol>'
          : '<ul>' + listItems.join('') + '</ul>';
        inList = false;
        listItems = [];
        listType = null;
      }
      formatted += '<h3>' + formatInlineStyles(h3Match[1]) + '</h3>';
      continue;
    }

    if (h2Match) {
      if (inList) {
        formatted += listType === 'ol'
          ? '<ol>' + listItems.join('') + '</ol>'
          : '<ul>' + listItems.join('') + '</ul>';
        inList = false;
        listItems = [];
        listType = null;
      }
      formatted += '<h2>' + formatInlineStyles(h2Match[1]) + '</h2>';
      continue;
    }

    if (h1Match) {
      if (inList) {
        formatted += listType === 'ol'
          ? '<ol>' + listItems.join('') + '</ol>'
          : '<ul>' + listItems.join('') + '</ul>';
        inList = false;
        listItems = [];
        listType = null;
      }
      formatted += '<h1>' + formatInlineStyles(h1Match[1]) + '</h1>';
      continue;
    }

    // Regular paragraph
    if (inList) {
      formatted += listType === 'ol'
        ? '<ol>' + listItems.join('') + '</ol>'
        : '<ul>' + listItems.join('') + '</ul>';
      inList = false;
      listItems = [];
      listType = null;
    }
    formatted += '<p>' + formatInlineStyles(line) + '</p>';
  }

  // Close any remaining list
  if (inList) {
    formatted += listType === 'ol'
      ? '<ol>' + listItems.join('') + '</ol>'
      : '<ul>' + listItems.join('') + '</ul>';
  }

  return formatted;
};

// Helper function to format inline styles (bold, italic, code)
const formatInlineStyles = (text) => {
  return text
    // Bold text (**text** or __text__)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic text (*text* or _text_) - but not * at start of line
    .replace(/(?<!^)\*([^\*]+?)\*/g, '<em>$1</em>')
    .replace(/(?<!^)_([^_]+?)_/g, '<em>$1</em>')
    // Code blocks
    .replace(/`(.+?)`/g, '<code>$1</code>');
};

function ChatInterface({ store, user, hideHeader = false, headerActions = null }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);

  // File management state (for owners)
  const [showFileModal, setShowFileModal] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const isOwner = store.access_level === 'owner';

  // Expose handlers for external header rendering
  useEffect(() => {
    if (headerActions) {
      headerActions({
        sessions,
        showHistory,
        setShowHistory,
        isOwner,
        handleNewSession,
        handleManageFiles
      });
    }
  }, [sessions, showHistory, isOwner]);

  useEffect(() => {
    loadSessions();
  }, [store.id]);

  useEffect(() => {
    if (activeSession) {
      loadMessages(activeSession.id);
    } else {
      setMessages([]);
    }
  }, [activeSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessions = async () => {
    try {
      const data = await getStoreSessions(store.id);
      setSessions(data.sessions);
      if (data.sessions.length > 0) {
        setActiveSession(data.sessions[0]);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const loadMessages = async (sessionId) => {
    setLoadingMessages(true);
    try {
      const data = await getSessionMessages(sessionId);
      setMessages(data.messages);
    } catch (err) {
      alert('Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleNewSession = async () => {
    const name = prompt('Enter a name for this chat session:');
    if (!name) return;

    try {
      const data = await createSession(store.id, name);
      setSessions([data.session, ...sessions]);
      setActiveSession(data.session);
    } catch (err) {
      alert('Failed to create session: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();

    if (!confirm('Delete this chat session?')) return;

    try {
      await deleteSession(sessionId);
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
      }
      loadSessions();
    } catch (err) {
      alert('Failed to delete session');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSession || loading) return;

    const userMessage = input;
    setInput('');
    setLoading(true);

    // Optimistically add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }]);

    try {
      const data = await sendMessage(activeSession.id, userMessage);

      // Replace with actual messages from server
      loadMessages(activeSession.id);
    } catch (err) {
      alert('Failed to send message: ' + (err.response?.data?.error || err.message));
      // Reload to get correct state
      loadMessages(activeSession.id);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // File management handlers (for owners)
  const loadFiles = async () => {
    try {
      const data = await getStoreFiles(store.id);
      setFiles(data.files);
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  };

  const handleManageFiles = () => {
    loadFiles();
    setShowFileModal(true);
  };

  const handleFileSelect = (e) => {
    setUploadFiles(Array.from(e.target.files));
  };

  const handleUploadFiles = async () => {
    if (uploadFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }

    const formData = new FormData();
    uploadFiles.forEach(file => {
      formData.append('files', file);
    });

    setUploading(true);
    try {
      await ownerUploadFiles(store.id, formData);
      alert('Files uploaded successfully!');
      setUploadFiles([]);
      loadFiles();
    } catch (err) {
      alert('Failed to upload files: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await ownerDeleteFile(store.id, fileId);
      alert('File deleted successfully!');
      loadFiles();
    } catch (err) {
      alert('Failed to delete file: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="chat-interface">
      {!hideHeader && (
        <div className="chat-header">
          <div className="chat-header-left">
            <div>
              <h2>{store.display_name}</h2>
              <p>{store.file_count} documents available {isOwner && <span className="owner-badge">👑 Owner</span>}</p>
            </div>
          </div>
          <div className="chat-header-actions">
            {sessions.length > 0 && (
              <button onClick={() => setShowHistory(!showHistory)} className="history-btn">
                📜 {showHistory ? 'Hide' : 'Show'} History ({sessions.length})
              </button>
            )}
            {isOwner && (
              <button onClick={handleManageFiles} className="manage-files-btn">
                📁 Manage Files
              </button>
            )}
            <button onClick={handleNewSession} className="new-chat-btn">
              + New Chat Session
            </button>
          </div>
        </div>
      )}

      {showHistory && sessions.length > 0 && (
        <div className="session-tabs">
          <div className="session-tabs-scroll">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`session-tab ${activeSession?.id === session.id ? 'active' : ''}`}
                onClick={() => setActiveSession(session)}
              >
                <span className="session-name">{session.session_name}</span>
                <button
                  className="close-tab"
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  title="Delete session"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="messages-container">
        {!activeSession ? (
          <div className="no-session-state">
            <div className="empty-icon">💬</div>
            <h3>No Chat Session</h3>
            <p>Create a new chat session to start asking questions</p>
            <button onClick={handleNewSession} className="primary-btn">
              + Create First Session
            </button>
          </div>
        ) : loadingMessages ? (
          <div className="loading-messages">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-icon">💬</div>
            <h3>Start a conversation</h3>
            <p>Ask questions about your documents</p>
            <div className="sample-questions">
              <p className="sample-label">Try asking:</p>
              <ul>
                <li>"Summarize the main points"</li>
                <li>"What are the key findings?"</li>
                <li>"Find information about [topic]"</li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <div className="message-header">
                  <span className="message-role">
                    {msg.role === 'user' ? 'You' : 'NXSYS_AI'}
                  </span>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div
                  className="message-content"
                  dangerouslySetInnerHTML={{ __html: formatMessageContent(msg.content) }}
                />
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {loading && (
          <div className="message assistant loading-message">
            <div className="message-header">
              <span className="message-role">NXSYS_AI</span>
            </div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {activeSession && (
        <div className="input-container">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your documents..."
            className="message-input"
            rows="3"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            className="send-btn"
            disabled={loading || !input.trim()}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      )}

      {/* File Management Modal (Owner Only) */}
      {showFileModal && isOwner && (
        <div className="modal-overlay" onClick={() => setShowFileModal(false)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manage Files - {store.display_name}</h3>
              <button onClick={() => setShowFileModal(false)} className="close-btn">×</button>
            </div>

            <div className="modal-form">
              {/* Upload Section */}
              <div className="file-upload-section">
                <h4>Upload New Files</h4>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  accept=".txt,.pdf,.docx,.md,.json,.py,.js,.csv,.html,.xml"
                />
                {uploadFiles.length > 0 && (
                  <div className="file-list">
                    {uploadFiles.map((file, idx) => (
                      <div key={idx} className="file-item">{file.name}</div>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleUploadFiles}
                  disabled={uploading || uploadFiles.length === 0}
                  className="primary-btn"
                >
                  {uploading ? 'Uploading...' : 'Upload Files'}
                </button>
              </div>

              {/* Existing Files Section */}
              <div className="existing-files-section">
                <h4>Existing Files ({files.length})</h4>
                <div className="files-list">
                  {files.length === 0 ? (
                    <p className="empty-message">No files found</p>
                  ) : (
                    files.map(file => (
                      <div key={file.id} className="file-row">
                        <div className="file-info">
                          <span className="file-name">📄 {file.name}</span>
                          {file.created_at && (
                            <span className="file-date">{new Date(file.created_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button onClick={() => setShowFileModal(false)} className="cancel-btn">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatInterface;
