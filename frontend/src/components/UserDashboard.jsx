import { useState, useEffect } from 'react';
import { getUserStores, logout } from '../utils/api';
import ChatInterface from './user/ChatInterface';
import logo from '../assets/logo.png';
import './UserDashboard.css';

function UserDashboard({ user, onLogout }) {
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const data = await getUserStores();
      setStores(data.stores);
      if (data.stores.length > 0) {
        setSelectedStore(data.stores[0]);
      }
    } catch (err) {
      alert('Failed to load stores');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  return (
    <div className="user-dashboard">
      <div className="sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="NXSYS" className="sidebar-logo" />
          <p className="user-name">Welcome {user.username}</p>
        </div>

        <div className="store-list">
          {loading ? (
            <div className="loading-sidebar">Loading...</div>
          ) : stores.length === 0 ? (
            <div className="empty-sidebar">
              <p>No stores assigned</p>
              <small>Contact admin for access</small>
            </div>
          ) : (
            stores.map(store => (
              <div
                key={store.id}
                className={`store-item ${selectedStore?.id === store.id ? 'active' : ''}`}
                onClick={() => setSelectedStore(store)}
              >
                <h3>{store.display_name}</h3>
                <div className="store-item-meta">
                  <span>{store.file_count} files</span>
                  <span>{store.session_count} chats</span>
                </div>
                {store.description && (
                  <p className="store-item-desc">{store.description}</p>
                )}
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn-sidebar">
            Logout
          </button>
        </div>
      </div>

      <div className="main-content">
        {selectedStore ? (
          <ChatInterface store={selectedStore} user={user} />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No Store Selected</h3>
            <p>Select a store from the sidebar to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserDashboard;
