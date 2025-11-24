import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Get JWT token from localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ==================== AUTHENTICATION ====================

export const login = async (username, password) => {
  const response = await axios.post(`${API_BASE_URL}/auth/login`, {
    username,
    password
  });
  if (response.data.access_token) {
    localStorage.setItem('token', response.data.access_token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
  }
  return response.data;
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getCurrentUser = async () => {
  const response = await axios.get(`${API_BASE_URL}/auth/me`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const getStoredUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

// ==================== OTP AUTHENTICATION ====================

export const sendVerificationOTP = async (email) => {
  const response = await axios.post(`${API_BASE_URL}/auth/send-verification-otp`, {
    email
  });
  return response.data;
};

export const verifyEmail = async (email, otpCode) => {
  const response = await axios.post(`${API_BASE_URL}/auth/verify-email`, {
    email,
    otp_code: otpCode
  });
  return response.data;
};

export const requestPasswordReset = async (email) => {
  const response = await axios.post(`${API_BASE_URL}/auth/request-password-reset`, {
    email
  });
  return response.data;
};

export const resetPassword = async (email, otpCode, newPassword) => {
  const response = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
    email,
    otp_code: otpCode,
    new_password: newPassword
  });
  return response.data;
};

// ==================== ADMIN - PROJECT MANAGEMENT ====================

export const listProjects = async () => {
  const response = await axios.get(`${API_BASE_URL}/admin/projects`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const createProject = async (projectData) => {
  const response = await axios.post(`${API_BASE_URL}/admin/projects`, projectData, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const updateProject = async (projectId, projectData) => {
  const response = await axios.put(`${API_BASE_URL}/admin/projects/${projectId}`, projectData, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const deleteProject = async (projectId) => {
  const response = await axios.delete(`${API_BASE_URL}/admin/projects/${projectId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const assignProjectToUser = async (projectId, userId, accessLevel = 'user') => {
  const response = await axios.post(`${API_BASE_URL}/admin/projects/${projectId}/assign`,
    { user_id: userId, access_level: accessLevel },
    { headers: getAuthHeaders() }
  );
  return response.data;
};

export const unassignProjectFromUser = async (projectId, userId) => {
  const response = await axios.delete(`${API_BASE_URL}/admin/projects/${projectId}/unassign/${userId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const getProjectUsers = async (projectId) => {
  const response = await axios.get(`${API_BASE_URL}/admin/projects/${projectId}/users`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const getProjectStores = async (projectId) => {
  const response = await axios.get(`${API_BASE_URL}/admin/projects/${projectId}/stores`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

// ==================== ADMIN - USER MANAGEMENT ====================

export const listUsers = async () => {
  const response = await axios.get(`${API_BASE_URL}/admin/users`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const createUser = async (userData) => {
  const response = await axios.post(`${API_BASE_URL}/admin/users`, userData, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const updateUser = async (userId, userData) => {
  const response = await axios.put(`${API_BASE_URL}/admin/users/${userId}`, userData, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const deleteUser = async (userId) => {
  const response = await axios.delete(`${API_BASE_URL}/admin/users/${userId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

// ==================== ADMIN - STORE MANAGEMENT ====================

export const adminListStores = async () => {
  const response = await axios.get(`${API_BASE_URL}/admin/stores`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const uploadStore = async (formData, onUploadProgress) => {
  const response = await axios.post(`${API_BASE_URL}/admin/upload`, formData, {
    headers: getAuthHeaders(),
    onUploadProgress: onUploadProgress
  });
  return response.data;
};

export const uploadFilesToStore = async (storeId, formData, onUploadProgress) => {
  const response = await axios.post(`${API_BASE_URL}/admin/stores/${storeId}/upload`, formData, {
    headers: getAuthHeaders(),
    onUploadProgress: onUploadProgress
  });
  return response.data;
};

export const updateStore = async (storeId, storeData) => {
  const response = await axios.put(`${API_BASE_URL}/admin/stores/${storeId}`, storeData, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const deleteStore = async (storeId) => {
  const response = await axios.delete(`${API_BASE_URL}/admin/stores/${storeId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const assignStoreToUser = async (storeId, userId, accessLevel = 'user') => {
  const response = await axios.post(`${API_BASE_URL}/admin/stores/${storeId}/assign`,
    { user_id: userId, access_level: accessLevel },
    { headers: getAuthHeaders() }
  );
  return response.data;
};

export const unassignStoreFromUser = async (storeId, userId) => {
  const response = await axios.delete(`${API_BASE_URL}/admin/stores/${storeId}/unassign/${userId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const getStoreUsers = async (storeId) => {
  const response = await axios.get(`${API_BASE_URL}/admin/stores/${storeId}/users`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

// ==================== END-USER - PROJECT & STORE ACCESS ====================

export const getUserProjects = async () => {
  const response = await axios.get(`${API_BASE_URL}/user/projects`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const getUserStores = async () => {
  const response = await axios.get(`${API_BASE_URL}/user/stores`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const getStoreFiles = async (storeId) => {
  const response = await axios.get(`${API_BASE_URL}/user/stores/${storeId}/files`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const getStoreSessions = async (storeId) => {
  const response = await axios.get(`${API_BASE_URL}/user/stores/${storeId}/sessions`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const createSession = async (storeId, sessionName) => {
  const response = await axios.post(
    `${API_BASE_URL}/user/stores/${storeId}/sessions`,
    { session_name: sessionName },
    { headers: getAuthHeaders() }
  );
  return response.data;
};

export const deleteSession = async (sessionId) => {
  const response = await axios.delete(`${API_BASE_URL}/user/sessions/${sessionId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const getSessionMessages = async (sessionId) => {
  const response = await axios.get(`${API_BASE_URL}/user/sessions/${sessionId}/messages`, {
    headers: getAuthHeaders()
  });
  return response.data;
};

export const sendMessage = async (sessionId, message) => {
  const response = await axios.post(
    `${API_BASE_URL}/user/sessions/${sessionId}/chat`,
    { message },
    { headers: getAuthHeaders() }
  );
  return response.data;
};

// ==================== OWNER - FILE MANAGEMENT ====================

export const ownerUploadFiles = async (storeId, formData, onUploadProgress) => {
  const response = await axios.post(`${API_BASE_URL}/owner/stores/${storeId}/upload`, formData, {
    headers: getAuthHeaders(),
    onUploadProgress: onUploadProgress
  });
  return response.data;
};

export const ownerDeleteFile = async (storeId, fileId) => {
  const response = await axios.delete(`${API_BASE_URL}/owner/stores/${storeId}/files/${fileId}`, {
    headers: getAuthHeaders()
  });
  return response.data;
};
