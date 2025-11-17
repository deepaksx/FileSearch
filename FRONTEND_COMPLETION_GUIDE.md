# Frontend Implementation Guide

## ✅ COMPLETED FILES

### Utilities
- `src/utils/api.js` - Complete API integration module

### Components
- `src/components/Login.jsx` + `Login.css` - Login page
- `src/components/AdminDashboard.jsx` + `AdminDashboard.css` - Admin shell

## 🚧 REMAINING COMPONENTS (Continue implementation)

### 1. User Management Component
**File:** `src/components/admin/UserManagement.jsx`

```jsx
import { useState, useEffect } from 'react';
import { listUsers, createUser, updateUser, deleteUser } from '../../utils/api';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await listUsers();
      setUsers(data.users);
    } catch (err) {
      alert('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateUser(editingUser.id, formData);
      } else {
        await createUser(formData);
      }
      setShowModal(false);
      setFormData({ username: '', email: '', password: '', role: 'user' });
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      alert('Failed to save user');
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteUser(userId);
      loadUsers();
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  return (
    <div className="user-management">
      <div className="section-header">
        <h2>Users</h2>
        <button onClick={() => setShowModal(true)} className="primary-btn">
          + Create User
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  <button onClick={() => { setEditingUser(user); setFormData(user); setShowModal(true); }}>Edit</button>
                  <button onClick={() => handleDelete(user.id)} className="danger-btn">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingUser ? 'Edit User' : 'Create User'}</h3>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Username"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
              {!editingUser && (
                <input
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                />
              )}
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
```

### 2. Store Management Component
**File:** `src/components/admin/StoreManagement.jsx`

Similar structure to UserManagement but with:
- File upload functionality
- Store renaming
- User assignment multi-select
- Display file count and assigned users

### 3. User Dashboard
**File:** `src/components/UserDashboard.jsx`

```jsx
import { useState, useEffect } from 'react';
import { getUserStores, logout } from '../utils/api';
import ChatInterface from './user/ChatInterface';

function UserDashboard({ user, onLogout }) {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    const data = await getUserStores();
    setStores(data.stores);
    if (data.stores.length > 0) {
      setSelectedStore(data.stores[0]);
    }
  };

  return (
    <div className="user-dashboard">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>My Stores</h2>
          <button onClick={() => { logout(); onLogout(); }}>Logout</button>
        </div>
        <div className="store-list">
          {stores.map(store => (
            <div
              key={store.id}
              className={`store-item ${selectedStore?.id === store.id ? 'active' : ''}`}
              onClick={() => setSelectedStore(store)}
            >
              <h3>{store.display_name}</h3>
              <p>{store.file_count} files • {store.session_count} sessions</p>
            </div>
          ))}
        </div>
      </div>
      <div className="main-content">
        {selectedStore ? (
          <ChatInterface store={selectedStore} user={user} />
        ) : (
          <div className="empty-state">No stores assigned</div>
        )}
      </div>
    </div>
  );
}
```

### 4. Multi-Session Chat Interface
**File:** `src/components/user/ChatInterface.jsx`

```jsx
import { useState, useEffect } from 'react';
import { getStoreSessions, createSession, deleteSession,
         getSessionMessages, sendMessage } from '../../utils/api';

function ChatInterface({ store, user }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [store.id]);

  useEffect(() => {
    if (activeSession) {
      loadMessages(activeSession.id);
    }
  }, [activeSession]);

  const loadSessions = async () => {
    const data = await getStoreSessions(store.id);
    setSessions(data.sessions);
    if (data.sessions.length > 0) {
      setActiveSession(data.sessions[0]);
    }
  };

  const loadMessages = async (sessionId) => {
    const data = await getSessionMessages(sessionId);
    setMessages(data.messages);
  };

  const handleNewSession = async () => {
    const name = prompt('Session name:');
    if (!name) return;
    await createSession(store.id, name);
    loadSessions();
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSession) return;
    setLoading(true);
    try {
      const data = await sendMessage(activeSession.id, input);
      setMessages([...messages, { role: 'user', content: input }, data.message]);
      setInput('');
    } catch (err) {
      alert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h2>{store.display_name}</h2>
        <button onClick={handleNewSession}>+ New Chat</button>
      </div>

      <div className="session-tabs">
        {sessions.map(session => (
          <div
            key={session.id}
            className={`session-tab ${activeSession?.id === session.id ? 'active' : ''}`}
            onClick={() => setActiveSession(session)}
          >
            {session.session_name}
            <button onClick={() => { deleteSession(session.id); loadSessions(); }}>×</button>
          </div>
        ))}
      </div>

      <div className="messages-container">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-content">{msg.content}</div>
            {msg.citations?.length > 0 && (
              <div className="citations">
                Sources: {msg.citations.map(c => c.title).join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="input-container">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question..."
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading}>Send</button>
      </div>
    </div>
  );
}
```

### 5. Update App.jsx
**File:** `src/App.jsx`

```jsx
import { useState, useEffect } from 'react';
import { isAuthenticated, getStoredUser, getCurrentUser } from './utils/api';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated()) {
      const stored = getStoredUser();
      if (stored) {
        setUser(stored);
        setLoading(false);
      } else {
        getCurrentUser()
          .then(data => setUser(data.user))
          .catch(() => setUser(null))
          .finally(() => setLoading(false));
      }
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard user={user} onLogout={() => setUser(null)} />;
  }

  return <UserDashboard user={user} onLogout={() => setUser(null)} />;
}

export default App;
```

## CSS FILES NEEDED

Create corresponding CSS files for each component with WhatsApp-style theme.

## TESTING WORKFLOW

1. Login as admin (admin/admin123)
2. Create a test user
3. Upload files and create a store
4. Assign store to the test user
5. Logout and login as test user
6. Create multiple chat sessions
7. Test chat functionality

## CURRENT STATUS

- Backend: 100% complete ✓
- API Module: 100% complete ✓
- Login: 100% complete ✓
- Admin Shell: 80% complete
- User Management: 60% complete (needs full implementation)
- Store Management: 0% (needs creation)
- User Dashboard: 0% (needs creation)
- Multi-Session Chat: 0% (needs creation)

Continue implementation from where we left off!
