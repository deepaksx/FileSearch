import { useState, useEffect } from 'react';
import { logout, getStoreFiles } from '../utils/api';
import UserManagement from './admin/UserManagement';
import ProjectManagement from './admin/ProjectManagement';
import StoreManagement from './admin/StoreManagement';
import ChatInterface from './user/ChatInterface';
import logo from '../assets/logo.png';
import './AdminDashboard.css';

function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('projects');
  const [selectedProject, setSelectedProject] = useState(null);
  const [chatStore, setChatStore] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatHeaderActions, setChatHeaderActions] = useState(null);

  useEffect(() => {
    // Check if there's a chat parameter in the URL
    const params = new URLSearchParams(window.location.search);
    const storeId = params.get('chat');
    if (storeId) {
      loadChatStore(storeId);
    }
  }, []);

  const loadChatStore = async (storeId) => {
    setLoadingChat(true);
    try {
      // Fetch store info to get display name
      const response = await fetch(`http://localhost:5000/api/admin/stores/${storeId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.store) {
        setChatStore({
          id: parseInt(storeId),
          display_name: data.store.display_name,
          access_level: 'owner'
        });
      }
    } catch (err) {
      console.error('Failed to load store:', err);
      alert('Failed to load chat. Please try again.');
    } finally {
      setLoadingChat(false);
    }
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setActiveTab('stores');
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setActiveTab('projects');
  };

  const handleCloseChatMode = () => {
    setChatStore(null);
    // Remove query parameter from URL
    window.history.replaceState({}, '', window.location.pathname);
  };

  // If in chat mode, show the chat interface
  if (chatStore) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '0.75rem 1.25rem',
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={handleCloseChatMode}
              style={{
                padding: '0.5rem 1rem',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem'
              }}
            >
              ← Back to Admin Dashboard
            </button>
            <h2 style={{ margin: 0, fontSize: '1.125rem', color: '#1e293b' }}>
              Admin Chat: {chatStore.display_name}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {chatHeaderActions && chatHeaderActions.sessions.length > 0 && (
              <button
                onClick={() => chatHeaderActions.setShowHistory(!chatHeaderActions.showHistory)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  transition: 'all 0.2s'
                }}
              >
                📜 {chatHeaderActions.showHistory ? 'Hide' : 'Show'} History ({chatHeaderActions.sessions.length})
              </button>
            )}
            {chatHeaderActions && chatHeaderActions.isOwner && (
              <button
                onClick={chatHeaderActions.handleManageFiles}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  transition: 'all 0.2s'
                }}
              >
                📁 Manage Files
              </button>
            )}
            {chatHeaderActions && (
              <button
                onClick={chatHeaderActions.handleNewSession}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#c9274b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  transition: 'all 0.2s'
                }}
              >
                + New Chat Session
              </button>
            )}
            <button onClick={handleLogout} style={{
              padding: '0.5rem 1rem',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.875rem'
            }}>
              Logout
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ChatInterface
            store={chatStore}
            user={user}
            hideHeader={true}
            headerActions={setChatHeaderActions}
          />
        </div>
      </div>
    );
  }

  if (loadingChat) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="admin-header-left">
          <img src={logo} alt="NXSYS" className="dashboard-logo" />
          <div>
            <h1>Admin Dashboard</h1>
            <p>Welcome, {user.username}</p>
          </div>
        </div>
        <div className="admin-header-right">
          <span className="user-badge">Admin</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          Projects
        </button>
        <button
          className={`tab-btn ${activeTab === 'stores' ? 'active' : ''}`}
          onClick={() => activeTab === 'stores' && !selectedProject ? setActiveTab('stores') : null}
          disabled={!selectedProject && activeTab !== 'stores'}
        >
          {selectedProject ? `${selectedProject.name} - Stores` : 'Stores'}
        </button>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
      </div>

      {selectedProject && activeTab === 'stores' && (
        <div className="breadcrumb">
          <button onClick={handleBackToProjects} className="breadcrumb-btn">
            ← Back to Projects
          </button>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{selectedProject.name}</span>
        </div>
      )}

      <div className="admin-content">
        {activeTab === 'projects' && <ProjectManagement onProjectSelect={handleProjectSelect} />}
        {activeTab === 'stores' && <StoreManagement selectedProject={selectedProject} />}
        {activeTab === 'users' && <UserManagement />}
      </div>
    </div>
  );
}

export default AdminDashboard;
