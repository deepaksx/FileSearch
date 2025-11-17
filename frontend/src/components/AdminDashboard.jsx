import { useState, useEffect } from 'react';
import { logout } from '../utils/api';
import UserManagement from './admin/UserManagement';
import StoreManagement from './admin/StoreManagement';
import logo from '../assets/logo.png';
import './AdminDashboard.css';

function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('users');

  const handleLogout = () => {
    logout();
    onLogout();
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
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Management
        </button>
        <button
          className={`tab-btn ${activeTab === 'stores' ? 'active' : ''}`}
          onClick={() => setActiveTab('stores')}
        >
          Store Management
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'stores' && <StoreManagement />}
      </div>
    </div>
  );
}

export default AdminDashboard;
