import { useState, useEffect } from 'react';
import { adminListStores, getProjectStores, uploadStore, uploadFilesToStore, updateStore, deleteStore,
         listUsers, assignStoreToUser, unassignStoreFromUser, getStoreUsers,
         getStoreFiles, ownerDeleteFile } from '../../utils/api';
import ProgressOverlay from './ProgressOverlay';
import './StoreManagement.css';

function StoreManagement({ selectedProject }) {
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showManageFilesModal, setShowManageFilesModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [storeFiles, setStoreFiles] = useState([]);
  const [manageFilesUpload, setManageFilesUpload] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  const [uploadFormData, setUploadFormData] = useState({
    display_name: '',
    description: '',
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown && !event.target.closest('.store-actions-dropdown')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdown]);

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

  const handleAssignUser = async (userId, accessLevel = 'user') => {
    try {
      await assignStoreToUser(selectedStore.id, userId, accessLevel);
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

  // File management handlers
  const handleManageFiles = async (store) => {
    setSelectedStore(store);
    try {
      const data = await getStoreFiles(store.id);
      setStoreFiles(data.files);
      setShowManageFilesModal(true);
    } catch (err) {
      alert('Failed to load files: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await ownerDeleteFile(selectedStore.id, fileId);
      alert('File deleted successfully!');
      // Reload files
      const data = await getStoreFiles(selectedStore.id);
      setStoreFiles(data.files);
      loadStores(); // Refresh store list to update file counts
    } catch (err) {
      alert('Failed to delete file: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleManageFilesUpload = async () => {
    if (manageFilesUpload.length === 0) {
      alert('Please select files to upload');
      return;
    }

    const formData = new FormData();
    manageFilesUpload.forEach(file => {
      formData.append('files', file);
    });

    setUploading(true);
    try {
      await uploadFilesToStore(selectedStore.id, formData);
      alert('Files uploaded successfully!');
      setManageFilesUpload([]);
      // Reload files
      const data = await getStoreFiles(selectedStore.id);
      setStoreFiles(data.files);
      loadStores();
    } catch (err) {
      alert('Failed to upload files: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleChatWithStore = (store) => {
    // Open chat in a new tab with query parameter
    const chatUrl = `${window.location.origin}?chat=${store.id}`;
    window.open(chatUrl, '_blank');
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

              <div className="store-actions-dropdown">
                <button
                  className="actions-dropdown-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdown(openDropdown === store.id ? null : store.id);
                  }}
                >
                  Actions ▼
                </button>
                {openDropdown === store.id && (
                  <div className="dropdown-menu">
                    <button onClick={() => { handleManageFiles(store); setOpenDropdown(null); }} className="dropdown-item">
                      📁 Manage Files
                    </button>
                    <button onClick={() => { handleChatWithStore(store); setOpenDropdown(null); }} className="dropdown-item">
                      💬 Chat
                    </button>
                    <button onClick={() => { handleEditStore(store); setOpenDropdown(null); }} className="dropdown-item">
                      ✏️ Edit
                    </button>
                    <button onClick={() => { handleManageAssignments(store); setOpenDropdown(null); }} className="dropdown-item">
                      👥 Manage Users
                    </button>
                    <button onClick={() => { handleDeleteStore(store.id); setOpenDropdown(null); }} className="dropdown-item delete">
                      🗑️ Delete
                    </button>
                  </div>
                )}
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
                  users.map(user => {
                    const assignedUser = assignedUsers.find(u => u.id === user.id);
                    const currentAccessLevel = assignedUser?.access_level || 'user';

                    return (
                      <div key={user.id} className="user-assignment-item">
                        <div className="user-info">
                          <strong>{user.username}</strong>
                          <span>{user.email}</span>
                          {isUserAssigned(user.id) && (
                            <span className={`access-badge ${currentAccessLevel}`}>
                              {currentAccessLevel === 'owner' ? '👑 Owner' : '👁️ Viewer'}
                            </span>
                          )}
                        </div>
                        <div className="user-actions">
                          {isUserAssigned(user.id) ? (
                            <>
                              <select
                                value={currentAccessLevel}
                                onChange={(e) => handleAssignUser(user.id, e.target.value)}
                                className="access-select"
                              >
                                <option value="user">Viewer</option>
                                <option value="owner">Owner</option>
                              </select>
                              <button
                                onClick={() => handleUnassignUser(user.id)}
                                className="unassign-btn"
                              >
                                Remove
                              </button>
                            </>
                          ) : (
                            <>
                              <select
                                id={`access-${user.id}`}
                                defaultValue="user"
                                className="access-select"
                              >
                                <option value="user">Viewer</option>
                                <option value="owner">Owner</option>
                              </select>
                              <button
                                onClick={() => {
                                  const select = document.getElementById(`access-${user.id}`);
                                  handleAssignUser(user.id, select.value);
                                }}
                                className="assign-user-btn"
                              >
                                Grant Access
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
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

      {/* Manage Files Modal */}
      {showManageFilesModal && (
        <div className="modal-overlay" onClick={() => setShowManageFilesModal(false)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manage Files - {selectedStore?.display_name}</h3>
              <button onClick={() => setShowManageFilesModal(false)} className="close-btn">×</button>
            </div>

            <div className="modal-form">
              {/* Upload New Files Section */}
              <div className="file-upload-section">
                <h4>Upload New Files</h4>
                <div className="form-group">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setManageFilesUpload(Array.from(e.target.files))}
                    accept=".txt,.pdf,.docx,.md,.json,.py,.js,.csv,.html,.xml"
                  />
                  {manageFilesUpload.length > 0 && (
                    <div className="file-list">
                      {manageFilesUpload.map((file, idx) => (
                        <div key={idx} className="file-item">{file.name}</div>
                      ))}
                    </div>
                  )}
                </div>
                {manageFilesUpload.length > 0 && (
                  <button
                    onClick={handleManageFilesUpload}
                    disabled={uploading}
                    className="primary-btn"
                  >
                    {uploading ? 'Uploading...' : `Upload ${manageFilesUpload.length} File(s)`}
                  </button>
                )}
              </div>

              <hr style={{ margin: '20px 0', border: '1px solid #ddd' }} />

              {/* Existing Files Section */}
              <div className="existing-files-section">
                <h4>Files in Store ({storeFiles.length})</h4>
                <div className="files-list">
                  {storeFiles.length === 0 ? (
                    <p className="empty-message">No files found</p>
                  ) : (
                    storeFiles.map(file => (
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
                <button onClick={() => setShowManageFilesModal(false)} className="cancel-btn">
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

export default StoreManagement;
