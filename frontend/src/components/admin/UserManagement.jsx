import { useState, useEffect } from 'react';
import { listUsers, createUser, updateUser, deleteUser } from '../../utils/api';
import './UserManagement.css';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
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
      alert('Failed to load users: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateUser(editingUser.id, formData);
        alert('User updated successfully');
      } else {
        await createUser(formData);
        alert('User created successfully');
      }
      setShowModal(false);
      setFormData({ username: '', email: '', password: '', role: 'user' });
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      alert('Failed to save user: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role
    });
    setShowModal(true);
  };

  const handleDelete = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await deleteUser(userId);
      alert('User deleted successfully');
      loadUsers();
    } catch (err) {
      alert('Failed to delete user: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({ username: '', email: '', password: '', role: 'user' });
  };

  return (
    <div className="user-management">
      <div className="section-header">
        <div>
          <h2>User Management</h2>
          <p>Manage system users and their roles</p>
        </div>
        <button onClick={() => setShowModal(true)} className="primary-btn">
          + Create User
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="empty-state">No users found</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Access</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td><strong>{user.username}</strong></td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge ${user.role}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="access-cell">
                    {user.role === 'admin' ? (
                      <span className="access-badge admin-access">All Access</span>
                    ) : (
                      <div className="access-summary">
                        {(user.projects_access?.length > 0 || user.stores_access?.length > 0) ? (
                          <>
                            <button
                              className="access-summary-btn"
                              onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                            >
                              <div className="access-counts">
                                {user.projects_access?.length > 0 && (
                                  <span className="access-count project">
                                    <span className="count-icon">📁</span>
                                    <span className="count-num">{user.projects_access.length}</span>
                                    <span className="count-label">project{user.projects_access.length !== 1 ? 's' : ''}</span>
                                    {user.projects_access.some(p => p.access_level === 'owner') && (
                                      <span className="has-owner">★</span>
                                    )}
                                  </span>
                                )}
                                {user.stores_access?.length > 0 && (
                                  <span className="access-count store">
                                    <span className="count-icon">🗄️</span>
                                    <span className="count-num">{user.stores_access.length}</span>
                                    <span className="count-label">store{user.stores_access.length !== 1 ? 's' : ''}</span>
                                    {user.stores_access.some(s => s.access_level === 'owner') && (
                                      <span className="has-owner">★</span>
                                    )}
                                  </span>
                                )}
                              </div>
                              <span className="expand-icon">{expandedUser === user.id ? '▲' : '▼'}</span>
                            </button>

                            {expandedUser === user.id && (
                              <div className="access-details">
                                {user.projects_access?.length > 0 && (
                                  <div className="access-detail-group">
                                    <div className="detail-header">Projects</div>
                                    <div className="detail-list">
                                      {user.projects_access.map(p => (
                                        <div key={p.id} className={`detail-item ${p.access_level}`}>
                                          <span className="detail-name">{p.name}</span>
                                          <span className={`detail-level ${p.access_level}`}>
                                            {p.access_level === 'owner' ? '★ Owner' : 'Viewer'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {user.stores_access?.length > 0 && (
                                  <div className="access-detail-group">
                                    <div className="detail-header">Direct Store Access</div>
                                    <div className="detail-list">
                                      {user.stores_access.map(s => (
                                        <div key={s.id} className={`detail-item ${s.access_level}`}>
                                          <span className="detail-name">{s.name}</span>
                                          <span className={`detail-level ${s.access_level}`}>
                                            {s.access_level === 'owner' ? '★ Owner' : 'Viewer'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="no-access">No access</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button onClick={() => handleEdit(user)} className="edit-btn">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(user.id)} className="delete-btn">
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

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingUser ? 'Edit User' : 'Create New User'}</h3>
              <button onClick={handleCloseModal} className="close-btn">×</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  placeholder="Enter email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>

              {!editingUser && (
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required
                  />
                </div>
              )}

              {editingUser && (
                <div className="form-group">
                  <label>New Password (leave empty to keep current)</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              )}

              <div className="form-group">
                <label>Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  required
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={handleCloseModal} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
