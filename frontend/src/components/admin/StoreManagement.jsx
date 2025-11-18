import { useState, useEffect } from 'react';
import { adminListStores, getProjectStores, uploadStore, uploadFilesToStore, updateStore, deleteStore,
         listUsers, assignStoreToUser, unassignStoreFromUser, getStoreUsers } from '../../utils/api';
import ProgressOverlay from './ProgressOverlay';
import './StoreManagement.css';

function StoreManagement({ selectedProject }) {
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddFilesModal, setShowAddFilesModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [assignedUsers, setAssignedUsers] = useState([]);

  const [uploadFormData, setUploadFormData] = useState({
    display_name: '',
    description: '',
    files: []
  });

  const [addFilesFormData, setAddFilesFormData] = useState({
    files: []
  });

  const [uploadProgress, setUploadProgress] = useState({
    show: false,
    progress: 0,
    fileCount: 0,
    currentFile: ''
  });

  const [editFormData, setEditFormData] = useState({
    display_name: '',
    description: ''
  });

  useEffect(() => {
    loadStores();
    loadUsers();
  }, [selectedProject]);

  const loadStores = async () => {
    if (!selectedProject) {
      setStores([]);
      setLoading(false);
      return;
    }

    try {
      const data = await getProjectStores(selectedProject.id);
      setStores(data.stores);
    } catch (err) {
      alert('Failed to load stores: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await listUsers();
      setUsers(data.users.filter(u => u.role === 'user'));
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleFileChange = (e) => {
    setUploadFormData({
      ...uploadFormData,
      files: Array.from(e.target.files)
    });
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProject) {
      alert('No project selected');
      return;
    }

    if (uploadFormData.files.length === 0) {
      alert('Please select files to upload');
      return;
    }

    const formData = new FormData();
    uploadFormData.files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('project_id', selectedProject.id);
    formData.append('display_name', uploadFormData.display_name);
    formData.append('description', uploadFormData.description);

    // Show progress overlay
    setUploadProgress({
      show: true,
      progress: 0,
      fileCount: uploadFormData.files.length,
      currentFile: uploadFormData.files[0]?.name || ''
    });

    try {
      await uploadStore(formData, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(prev => ({
          ...prev,
          progress: percentCompleted
        }));
      });

      alert('Store created successfully!');
      setShowUploadModal(false);
      setUploadFormData({ display_name: '', description: '', files: [] });
      setUploadProgress({ show: false, progress: 0, fileCount: 0, currentFile: '' });
      loadStores();
    } catch (err) {
      setUploadProgress({ show: false, progress: 0, fileCount: 0, currentFile: '' });
      alert('Failed to upload files: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAddFilesToStore = (store) => {
    setSelectedStore(store);
    setAddFilesFormData({ files: [] });
    setShowAddFilesModal(true);
  };

  const handleAddFilesChange = (e) => {
    setAddFilesFormData({
      files: Array.from(e.target.files)
    });
  };

  const handleAddFilesSubmit = async (e) => {
    e.preventDefault();

    if (addFilesFormData.files.length === 0) {
      alert('Please select files to upload');
      return;
    }

    const formData = new FormData();
    addFilesFormData.files.forEach(file => {
      formData.append('files', file);
    });

    // Show progress overlay
    setUploadProgress({
      show: true,
      progress: 0,
      fileCount: addFilesFormData.files.length,
      currentFile: addFilesFormData.files[0]?.name || ''
    });

    try {
      await uploadFilesToStore(selectedStore.id, formData, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(prev => ({
          ...prev,
          progress: percentCompleted
        }));
      });

      alert('Files uploaded successfully!');
      setShowAddFilesModal(false);
      setAddFilesFormData({ files: [] });
      setUploadProgress({ show: false, progress: 0, fileCount: 0, currentFile: '' });
      loadStores();
    } catch (err) {
      setUploadProgress({ show: false, progress: 0, fileCount: 0, currentFile: '' });
      alert('Failed to upload files: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleEditStore = (store) => {
    setSelectedStore(store);
    setEditFormData({
      display_name: store.display_name,
      description: store.description || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateStore(selectedStore.id, editFormData);
      alert('Store updated successfully!');
      setShowEditModal(false);
      loadStores();
    } catch (err) {
      alert('Failed to update store: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteStore = async (storeId) => {
    if (!confirm('Are you sure? This will delete the store and all its files!')) return;

    try {
      await deleteStore(storeId);
      alert('Store deleted successfully!');
      loadStores();
    } catch (err) {
      alert('Failed to delete store: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleManageAssignments = async (store) => {
    setSelectedStore(store);
    try {
      const data = await getStoreUsers(store.id);
      setAssignedUsers(data.users);
      setShowAssignModal(true);
    } catch (err) {
      alert('Failed to load assignments: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAssignUser = async (userId) => {
    try {
      await assignStoreToUser(selectedStore.id, userId);
      const data = await getStoreUsers(selectedStore.id);
      setAssignedUsers(data.users);
      loadStores();
    } catch (err) {
      alert('Failed to assign user: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUnassignUser = async (userId) => {
    try {
      await unassignStoreFromUser(selectedStore.id, userId);
      const data = await getStoreUsers(selectedStore.id);
      setAssignedUsers(data.users);
      loadStores();
    } catch (err) {
      alert('Failed to unassign user: ' + (err.response?.data?.error || err.message));
    }
  };

  const isUserAssigned = (userId) => {
    return assignedUsers.some(u => u.id === userId);
  };

  return (
    <div className="store-management">
      {uploadProgress.show && (
        <ProgressOverlay
          progress={uploadProgress.progress}
          fileCount={uploadProgress.fileCount}
          currentFile={uploadProgress.currentFile}
        />
      )}

      <div className="section-header">
        <div>
          <h2>Store Management</h2>
          <p>{selectedProject ? `Managing stores in ${selectedProject.name}` : 'Select a project to manage stores'}</p>
        </div>
        {selectedProject && (
          <button onClick={() => setShowUploadModal(true)} className="primary-btn">
            + Upload Files & Create Store
          </button>
        )}
      </div>

      {!selectedProject ? (
        <div className="empty-state">
          <p>Please select a project from the Projects tab to manage its stores.</p>
        </div>
      ) : loading ? (
        <div className="loading-state">Loading stores...</div>
      ) : stores.length === 0 ? (
        <div className="empty-state">No stores found in this project. Create one to get started!</div>
      ) : (
        <div className="stores-grid">
          {stores.map(store => (
            <div key={store.id} className="store-card">
              <div className="store-card-header">
                <h3>{store.display_name}</h3>
                <div className="store-stats">
                  <span className="stat-badge">{store.file_count} files</span>
                  <span className="stat-badge">{store.assigned_users} users</span>
                </div>
              </div>

              {store.description && (
                <p className="store-description">{store.description}</p>
              )}

              <div className="store-meta">
                <small>Created: {new Date(store.created_at).toLocaleDateString()}</small>
              </div>

              <div className="store-actions">
                <button onClick={() => handleAddFilesToStore(store)} className="add-files-btn">
                  Add Files
                </button>
                <button onClick={() => handleEditStore(store)} className="edit-btn">
                  Edit
                </button>
                <button onClick={() => handleManageAssignments(store)} className="assign-btn">
                  Manage Users
                </button>
                <button onClick={() => handleDeleteStore(store.id)} className="delete-btn">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Files & Create Store</h3>
              <button onClick={() => setShowUploadModal(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleUploadSubmit} className="modal-form">
              <div className="form-group">
                <label>Store Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Product Documentation"
                  value={uploadFormData.display_name}
                  onChange={(e) => setUploadFormData({...uploadFormData, display_name: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  placeholder="Brief description of this store"
                  value={uploadFormData.description}
                  onChange={(e) => setUploadFormData({...uploadFormData, description: e.target.value})}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Files * (txt, pdf, docx, md, json, py, js, csv, html, xml)</label>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept=".txt,.pdf,.docx,.md,.json,.py,.js,.csv,.html,.xml"
                  required
                />
                {uploadFormData.files.length > 0 && (
                  <div className="file-list">
                    {uploadFormData.files.map((file, idx) => (
                      <div key={idx} className="file-item">{file.name}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowUploadModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Upload & Create Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Files to Existing Store Modal */}
      {showAddFilesModal && (
        <div className="modal-overlay" onClick={() => setShowAddFilesModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Files to {selectedStore?.display_name}</h3>
              <button onClick={() => setShowAddFilesModal(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleAddFilesSubmit} className="modal-form">
              <div className="form-group">
                <label>Files * (txt, pdf, docx, md, json, py, js, csv, html, xml)</label>
                <input
                  type="file"
                  multiple
                  onChange={handleAddFilesChange}
                  accept=".txt,.pdf,.docx,.md,.json,.py,.js,.csv,.html,.xml"
                  required
                />
                {addFilesFormData.files.length > 0 && (
                  <div className="file-list">
                    {addFilesFormData.files.map((file, idx) => (
                      <div key={idx} className="file-item">{file.name}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddFilesModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Upload Files
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Store</h3>
              <button onClick={() => setShowEditModal(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="form-group">
                <label>Store Name *</label>
                <input
                  type="text"
                  value={editFormData.display_name}
                  onChange={(e) => setEditFormData({...editFormData, display_name: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                  rows="3"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowEditModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Update Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Users Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manage User Access - {selectedStore?.display_name}</h3>
              <button onClick={() => setShowAssignModal(false)} className="close-btn">×</button>
            </div>

            <div className="modal-form">
              <div className="user-assignment-list">
                {users.length === 0 ? (
                  <p className="empty-message">No users available. Create users first.</p>
                ) : (
                  users.map(user => (
                    <div key={user.id} className="user-assignment-item">
                      <div className="user-info">
                        <strong>{user.username}</strong>
                        <span>{user.email}</span>
                      </div>
                      <button
                        onClick={() => isUserAssigned(user.id) ? handleUnassignUser(user.id) : handleAssignUser(user.id)}
                        className={isUserAssigned(user.id) ? 'unassign-btn' : 'assign-user-btn'}
                      >
                        {isUserAssigned(user.id) ? 'Remove Access' : 'Grant Access'}
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="modal-actions">
                <button onClick={() => setShowAssignModal(false)} className="primary-btn">
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StoreManagement;
