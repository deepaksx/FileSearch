import { useState, useEffect } from 'react';
import { getUserProjects, getUserStores, logout } from '../utils/api';
import ChatInterface from './user/ChatInterface';
import logo from '../assets/logo.png';
import './UserDashboard.css';

function UserDashboard({ user, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsData, storesData] = await Promise.all([
        getUserProjects(),
        getUserStores()
      ]);

      setProjects(projectsData.projects);
      setStores(storesData.stores);

      // Auto-expand first project and select first store
      if (projectsData.projects.length > 0) {
        setExpandedProjects(new Set([projectsData.projects[0].id]));
      }
      if (storesData.stores.length > 0) {
        setSelectedStore(storesData.stores[0]);
      }
    } catch (err) {
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleProject = (projectId) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const getStoresByProject = (projectId) => {
    return stores.filter(store => store.project_id === projectId);
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const handleStoreSelect = (store) => {
    setSelectedStore(store);
    setSidebarOpen(false); // Close sidebar on mobile after selection
  };

  return (
    <div className="user-dashboard">
      {/* Mobile Header with Menu Toggle */}
      <div className="mobile-header">
        <button
          className="menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
        <img src={logo} alt="NXSYS" className="mobile-logo" />
        <span className="mobile-store-name">
          {selectedStore?.display_name || 'Select a store'}
        </span>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src={logo} alt="NXSYS" className="sidebar-logo" />
          <p className="user-name">Welcome {user.username}</p>
        </div>

        <div className="project-list">
          {loading ? (
            <div className="loading-sidebar">Loading...</div>
          ) : projects.length === 0 && stores.length === 0 ? (
            <div className="empty-sidebar">
              <p>No access assigned</p>
              <small>Contact admin for access</small>
            </div>
          ) : (
            <>
              {projects.map(project => {
                const projectStores = getStoresByProject(project.id);
                const isExpanded = expandedProjects.has(project.id);

                return (
                  <div key={project.id} className="project-group">
                    <div
                      className="project-header"
                      onClick={() => toggleProject(project.id)}
                    >
                      <span className="project-icon">{isExpanded ? '▼' : '▶'}</span>
                      <div className="project-info">
                        <h3>{project.name}</h3>
                        <span className="project-count">{projectStores.length} stores</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="project-stores">
                        {projectStores.length === 0 ? (
                          <div className="empty-project">No stores in this project</div>
                        ) : (
                          projectStores.map(store => (
                            <div
                              key={store.id}
                              className={`store-item ${selectedStore?.id === store.id ? 'active' : ''}`}
                              onClick={() => handleStoreSelect(store)}
                            >
                              <div className="store-item-name">{store.display_name}</div>
                              <div className="store-item-meta">
                                <span>📄 {store.file_count}</span>
                                <span>💬 {store.session_count}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Show stores not in any project (direct assignments) */}
              {stores.filter(s => !projects.some(p => p.id === s.project_id)).length > 0 && (
                <div className="project-group">
                  <div className="project-header direct-access">
                    <span className="project-icon">📌</span>
                    <div className="project-info">
                      <h3>Direct Access</h3>
                      <span className="project-count">Individual stores</span>
                    </div>
                  </div>
                  <div className="project-stores">
                    {stores
                      .filter(s => !projects.some(p => p.id === s.project_id))
                      .map(store => (
                        <div
                          key={store.id}
                          className={`store-item ${selectedStore?.id === store.id ? 'active' : ''}`}
                          onClick={() => handleStoreSelect(store)}
                        >
                          <div className="store-item-name">{store.display_name}</div>
                          <div className="store-item-meta">
                            <span>📄 {store.file_count}</span>
                            <span>💬 {store.session_count}</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </>
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
