import { useState, useEffect } from 'react';
import './GeminiStoreManager.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function GeminiStoreManager() {
  const [stores, setStores] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, imported: 0, orphaned: 0 });

  // Modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Selected store for modals
  const [selectedStore, setSelectedStore] = useState(null);
  const [storeFiles, setStoreFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Import form
  const [importForm, setImportForm] = useState({
    project_id: '',
    display_name: '',
    description: ''
  });
  const [importing, setImporting] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState('list'); // 'tile' or 'list'

  useEffect(() => {
    fetchStores();
    fetchProjects();
  }, []);

  const fetchStores = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/admin/gemini-stores`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setStores(data.stores);
        setStats({
          total: data.total,
          imported: data.imported,
          orphaned: data.orphaned
        });
      } else {
        setError(data.error || 'Failed to fetch RAG stores');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/projects`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  const handleViewFiles = async (store) => {
    setSelectedStore(store);
    setShowFilesModal(true);
    setLoadingFiles(true);
    setStoreFiles([]);

    try {
      const response = await fetch(`${API_URL}/admin/gemini-stores/${encodeURIComponent(store.gemini_store_id)}/files`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setStoreFiles(data.files);
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleImportClick = (store) => {
    setSelectedStore(store);
    setImportForm({
      project_id: '',
      display_name: store.display_name || '',
      description: ''
    });
    setShowImportModal(true);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importForm.project_id || !importForm.display_name) {
      alert('Please select a project and enter a display name');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch(`${API_URL}/admin/gemini-stores/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gemini_store_id: selectedStore.gemini_store_id,
          project_id: parseInt(importForm.project_id),
          display_name: importForm.display_name,
          description: importForm.description
        })
      });
      const data = await response.json();
      if (data.success) {
        alert('Store imported successfully!');
        setShowImportModal(false);
        fetchStores();
      } else {
        alert(data.error || 'Failed to import store');
      }
    } catch (err) {
      alert('Failed to import store');
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteClick = (store) => {
    setSelectedStore(store);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/gemini-stores/${encodeURIComponent(selectedStore.gemini_store_id)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        alert('Store deleted successfully!');
        setShowDeleteConfirm(false);
        fetchStores();
      } else {
        alert(data.error || 'Failed to delete store');
      }
    } catch (err) {
      alert('Failed to delete store');
    }
  };

  if (loading) {
    return <div className="loading-state">Loading RAG stores...</div>;
  }

  if (error) {
    return (
      <div className="error-state">
        <p>{error}</p>
        <button onClick={fetchStores} className="retry-btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="gemini-store-manager">
      <div className="section-header">
        <div>
          <h2>RAG Store Manager</h2>
          <p>Manage RAG file stores in your cloud account</p>
        </div>
        <div className="header-actions">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'tile' ? 'active' : ''}`}
              onClick={() => setViewMode('tile')}
              title="Tile View"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1"/>
                <rect x="9" y="1" width="6" height="6" rx="1"/>
                <rect x="1" y="9" width="6" height="6" rx="1"/>
                <rect x="9" y="9" width="6" height="6" rx="1"/>
              </svg>
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="14" height="2" rx="0.5"/>
                <rect x="1" y="7" width="14" height="2" rx="0.5"/>
                <rect x="1" y="12" width="14" height="2" rx="0.5"/>
              </svg>
            </button>
          </div>
          <button onClick={fetchStores} className="refresh-btn">
            Refresh
          </button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total Stores</span>
        </div>
        <div className="stat-item imported">
          <span className="stat-value">{stats.imported}</span>
          <span className="stat-label">Imported</span>
        </div>
        <div className="stat-item orphaned">
          <span className="stat-value">{stats.orphaned}</span>
          <span className="stat-label">Not Imported</span>
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="empty-state">
          <p>No RAG stores found in your account.</p>
        </div>
      ) : viewMode === 'tile' ? (
        <div className="gemini-stores-list">
          {stores.map((store) => (
            <div key={store.gemini_store_id} className={`gemini-store-card ${store.is_imported ? 'imported' : 'orphaned'}`}>
              <div className="store-card-header">
                <h3>{store.display_name}</h3>
                <span className={`status-badge ${store.is_imported ? 'imported' : 'orphaned'}`}>
                  {store.is_imported ? 'Imported' : 'Not Imported'}
                </span>
              </div>

              <div className="store-card-details">
                <div className="detail-row">
                  <span className="detail-label">Store ID:</span>
                  <span className="detail-value gemini-id">{store.gemini_store_id}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Files:</span>
                  <span className="detail-value">{store.file_count}</span>
                </div>
                {store.is_imported && (
                  <>
                    <div className="detail-row">
                      <span className="detail-label">App Name:</span>
                      <span className="detail-value">{store.db_display_name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Project ID:</span>
                      <span className="detail-value">{store.db_project_id}</span>
                    </div>
                  </>
                )}
                {store.create_time && (
                  <div className="detail-row">
                    <span className="detail-label">Created:</span>
                    <span className="detail-value">{new Date(store.create_time).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="store-card-actions">
                <button onClick={() => handleViewFiles(store)} className="view-files-btn">
                  View Files
                </button>
                <button onClick={() => handleImportClick(store)} className={store.is_imported ? "reimport-btn" : "import-btn"}>
                  {store.is_imported ? 'Re-import' : 'Import'}
                </button>
                <button onClick={() => handleDeleteClick(store)} className="delete-gemini-btn">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="stores-table-container">
          <table className="stores-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Store ID</th>
                <th>Files</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.gemini_store_id} className={store.is_imported ? 'imported' : 'orphaned'}>
                  <td className="store-name-cell">
                    <span className="store-name">{store.display_name}</span>
                    {store.is_imported && store.db_display_name !== store.display_name && (
                      <span className="app-name-sub">App: {store.db_display_name}</span>
                    )}
                  </td>
                  <td className="store-id-cell">
                    <span className="store-id-text">{store.gemini_store_id}</span>
                  </td>
                  <td className="files-cell">{store.file_count}</td>
                  <td className="date-cell">
                    {store.create_time ? new Date(store.create_time).toLocaleDateString() : '-'}
                  </td>
                  <td className="status-cell">
                    <span className={`status-badge ${store.is_imported ? 'imported' : 'orphaned'}`}>
                      {store.is_imported ? 'Imported' : 'Not Imported'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <div className="table-actions">
                      <button onClick={() => handleViewFiles(store)} className="table-action-btn view">
                        Files
                      </button>
                      <button onClick={() => handleImportClick(store)} className={`table-action-btn ${store.is_imported ? 'reimport' : 'import'}`}>
                        {store.is_imported ? 'Re-import' : 'Import'}
                      </button>
                      <button onClick={() => handleDeleteClick(store)} className="table-action-btn delete">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Files Modal */}
      {showFilesModal && selectedStore && (
        <div className="modal-overlay" onClick={() => setShowFilesModal(false)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Files in {selectedStore.display_name}</h3>
              <button onClick={() => setShowFilesModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-content">
              {loadingFiles ? (
                <div className="loading-state">Loading files...</div>
              ) : storeFiles.length === 0 ? (
                <div className="empty-files">No files in this store</div>
              ) : (
                <div className="files-list-modal">
                  {storeFiles.map((file) => (
                    <div key={file.id} className="file-item-modal">
                      <span className="file-name">{file.display_name}</span>
                      {file.create_time && (
                        <span className="file-date">{new Date(file.create_time).toLocaleDateString()}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && selectedStore && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import RAG Store</h3>
              <button onClick={() => setShowImportModal(false)} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleImportSubmit} className="modal-form">
              <div className="form-group">
                <label>Store ID</label>
                <input type="text" value={selectedStore.gemini_store_id} disabled />
              </div>
              <div className="form-group">
                <label>Project *</label>
                <select
                  value={importForm.project_id}
                  onChange={(e) => setImportForm({ ...importForm, project_id: e.target.value })}
                  required
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Display Name *</label>
                <input
                  type="text"
                  value={importForm.display_name}
                  onChange={(e) => setImportForm({ ...importForm, display_name: e.target.value })}
                  placeholder="Enter display name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={importForm.description}
                  onChange={(e) => setImportForm({ ...importForm, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowImportModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={importing}>
                  {importing ? 'Importing...' : 'Import Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedStore && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete RAG Store</h3>
              <button onClick={() => setShowDeleteConfirm(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-content">
              <p className="delete-warning">
                Are you sure you want to permanently delete this RAG store?
              </p>
              <p className="store-name-confirm">{selectedStore.display_name}</p>
              <p className="delete-note">
                This will delete all files in the store. This action cannot be undone.
              </p>
              {selectedStore.is_imported && (
                <p className="delete-note imported-note">
                  This store is currently imported in the app and will also be removed from the database.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteConfirm(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} className="delete-confirm-btn">
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GeminiStoreManager;
