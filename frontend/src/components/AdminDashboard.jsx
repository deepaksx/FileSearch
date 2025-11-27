import { useState, useEffect } from 'react';
import { logout, getStoreFiles } from '../utils/api';
import UserManagement from './admin/UserManagement';
import ProjectManagement from './admin/ProjectManagement';
import StoreManagement from './admin/StoreManagement';
import GeminiStoreManager from './admin/GeminiStoreManager';
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
      <div className="admin-chat-mode">
        <div className="admin-chat-header">
          <div className="admin-chat-header-left">
            <button
              onClick={handleCloseChatMode}
              className="admin-chat-back-btn"
            >
              ← Back
            </button>
            <h2 className="admin-chat-title">
              {chatStore.display_name}
            </h2>
          </div>
          <div className="admin-chat-header-right">
            {chatHeaderActions && chatHeaderActions.sessions.length > 0 && (
              <button
                onClick={() => chatHeaderActions.setShowHistory(!chatHeaderActions.showHistory)}
                className="admin-chat-btn secondary"
              >
                <span className="btn-icon">📜</span>
                <span className="btn-text">{chatHeaderActions.showHistory ? 'Hide' : 'History'}</span>
              </button>
            )}
            {chatHeaderActions && chatHeaderActions.isOwner && (
              <button
                onClick={chatHeaderActions.handleManageFiles}
                className="admin-chat-btn primary"
              >
                <span className="btn-icon">📁</span>
                <span className="btn-text">Files</span>
              </button>
            )}
            {chatHeaderActions && (
              <button
                onClick={chatHeaderActions.handleNewSession}
                className="admin-chat-btn accent"
              >
                <span className="btn-icon">+</span>
                <span className="btn-text">New</span>
              </button>
            )}
            <button onClick={handleLogout} className="admin-chat-btn danger">
              <span className="btn-text-only">Logout</span>
            </button>
          </div>
        </div>
        <div className="admin-chat-content">
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
        <button
          className={`tab-btn ${activeTab === 'rag-stores' ? 'active' : ''}`}
          onClick={() => setActiveTab('rag-stores')}
        >
          RAG Stores
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
        {activeTab === 'rag-stores' && <GeminiStoreManager />}
      </div>
    </div>
  );
}

export default AdminDashboard;
