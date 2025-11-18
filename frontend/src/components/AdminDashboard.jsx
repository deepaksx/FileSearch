import { useState, useEffect } from 'react';
import { logout } from '../utils/api';
import UserManagement from './admin/UserManagement';
import ProjectManagement from './admin/ProjectManagement';
import StoreManagement from './admin/StoreManagement';
import logo from '../assets/logo.png';
import './AdminDashboard.css';

function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('projects');
  const [selectedProject, setSelectedProject] = useState(null);

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
