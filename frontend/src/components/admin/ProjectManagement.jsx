import { useState, useEffect } from 'react';
import { listProjects, createProject, updateProject, deleteProject,
         listUsers, assignProjectToUser, unassignProjectFromUser, getProjectUsers } from '../../utils/api';
import './ProjectManagement.css';

function ProjectManagement({ onProjectSelect }) {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [assignedUsers, setAssignedUsers] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    loadProjects();
    loadUsers();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await listProjects();
      setProjects(data.projects);
    } catch (err) {
      alert('Failed to load projects: ' + (err.response?.data?.error || err.message));
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

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await createProject(formData);
      alert('Project created successfully!');
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      loadProjects();
    } catch (err) {
      alert('Failed to create project: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleEditProject = (project) => {
    setSelectedProject(project);
    setFormData({
      name: project.name,
      description: project.description || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateProject(selectedProject.id, formData);
      alert('Project updated successfully!');
      setShowEditModal(false);
      loadProjects();
    } catch (err) {
      alert('Failed to update project: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!confirm('Are you sure? This will delete the project and ALL its stores!')) return;

    try {
      await deleteProject(projectId);
      alert('Project deleted successfully!');
      loadProjects();
    } catch (err) {
      alert('Failed to delete project: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleManageAssignments = async (project) => {
    setSelectedProject(project);
    try {
      const data = await getProjectUsers(project.id);
      setAssignedUsers(data.users);
      setShowAssignModal(true);
    } catch (err) {
      alert('Failed to load assignments: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAssignUser = async (userId, accessLevel = 'user') => {
    try {
      await assignProjectToUser(selectedProject.id, userId, accessLevel);
      const data = await getProjectUsers(selectedProject.id);
      setAssignedUsers(data.users);
      loadProjects();
    } catch (err) {
      alert('Failed to assign user: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUnassignUser = async (userId) => {
    try {
      await unassignProjectFromUser(selectedProject.id, userId);
      const data = await getProjectUsers(selectedProject.id);
      setAssignedUsers(data.users);
      loadProjects();
    } catch (err) {
      alert('Failed to unassign user: ' + (err.response?.data?.error || err.message));
    }
  };

  const isUserAssigned = (userId) => {
    return assignedUsers.some(u => u.id === userId);
  };

  return (
    <div className="project-management">
      <div className="section-header">
        <div>
          <h2>Project Management</h2>
          <p>Organize stores into projects and manage access</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="primary-btn">
          + Create Project
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">No projects found. Create one to get started!</div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => (
            <div key={project.id} className="project-card">
              <div className="project-card-header">
                <h3>{project.name}</h3>
                <div className="project-stats">
                  <span className="stat-badge">{project.store_count} stores</span>
                  <span className="stat-badge">{project.assigned_users} users</span>
                </div>
              </div>

              {project.description && (
                <p className="project-description">{project.description}</p>
              )}

              <div className="project-meta">
                <small>Created: {new Date(project.created_at).toLocaleDateString()}</small>
              </div>

              <div className="project-actions">
                <button onClick={() => onProjectSelect(project)} className="view-stores-btn">
                  View Stores
                </button>
                <button onClick={() => handleEditProject(project)} className="edit-btn">
                  Edit
                </button>
                <button onClick={() => handleManageAssignments(project)} className="assign-btn">
                  Manage Users
                </button>
                <button onClick={() => handleDeleteProject(project.id)} className="delete-btn">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Project</h3>
              <button onClick={() => setShowCreateModal(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="modal-form">
              <div className="form-group">
                <label>Project Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Customer Support Documentation"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  placeholder="Brief description of this project"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreateModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Create Project
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
              <h3>Edit Project</h3>
              <button onClick={() => setShowEditModal(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="form-group">
                <label>Project Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowEditModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  Update Project
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
              <h3>Manage User Access - {selectedProject?.name}</h3>
              <button onClick={() => setShowAssignModal(false)} className="close-btn">×</button>
            </div>

            <div className="modal-form">
              <div className="info-message">
                Users assigned to this project will have access to all stores within it.
              </div>

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
    </div>
  );
}

export default ProjectManagement;
