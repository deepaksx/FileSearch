import { useState, useEffect } from 'react'
import axios from 'axios'
import './StoreManager.css'

function StoreManager({ onClose }) {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedStore, setExpandedStore] = useState(null)
  const [storeFiles, setStoreFiles] = useState({})

  useEffect(() => {
    loadStores()
  }, [])

  const loadStores = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/stores/list')
      if (response.data.success) {
        setStores(response.data.stores)
      }
    } catch (err) {
      console.error('Failed to load stores:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadStoreFiles = async (storeId) => {
    try {
      const response = await axios.get(`/api/stores/${storeId}/files`)
      if (response.data.success) {
        setStoreFiles(prev => ({
          ...prev,
          [storeId]: response.data.files
        }))
      }
    } catch (err) {
      console.error('Failed to load store files:', err)
    }
  }

  const toggleStore = (storeId) => {
    if (expandedStore === storeId) {
      setExpandedStore(null)
    } else {
      setExpandedStore(storeId)
      if (!storeFiles[storeId]) {
        loadStoreFiles(storeId)
      }
    }
  }

  const deleteStore = async (storeId) => {
    if (!confirm('Are you sure you want to delete this entire store and all its files?')) {
      return
    }

    try {
      const response = await axios.delete(`/api/stores/${storeId}`)
      if (response.data.success) {
        setStores(stores.filter(s => s.id !== storeId))
        alert('Store deleted successfully!')
      }
    } catch (err) {
      alert('Failed to delete store: ' + (err.response?.data?.error || err.message))
    }
  }

  const deleteFile = async (storeId, fileName) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return
    }

    try {
      const response = await axios.delete(`/api/stores/${storeId}/files/${encodeURIComponent(fileName)}`)
      if (response.data.success) {
        setStoreFiles(prev => ({
          ...prev,
          [storeId]: prev[storeId].filter(f => f.name !== fileName)
        }))
        alert('File deleted successfully!')
      }
    } catch (err) {
      alert('Failed to delete file: ' + (err.response?.data?.error || err.message))
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const formatSize = (bytes) => {
    if (!bytes) return 'N/A'
    const kb = bytes / 1024
    const mb = kb / 1024
    if (mb >= 1) return `${mb.toFixed(2)} MB`
    return `${kb.toFixed(2)} KB`
  }

  return (
    <div className="store-manager-overlay">
      <div className="store-manager">
        <div className="store-manager-header">
          <h2>📦 File Search Store Manager</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="store-manager-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading stores...</p>
            </div>
          ) : stores.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3>No stores found</h3>
              <p>Upload some files to create your first store</p>
            </div>
          ) : (
            <div className="stores-list">
              <div className="stores-summary">
                <p>Total Stores: <strong>{stores.length}</strong></p>
                <button
                  className="refresh-btn"
                  onClick={loadStores}
                >
                  🔄 Refresh
                </button>
              </div>

              {stores.map((store) => (
                <div key={store.id} className="store-item">
                  <div className="store-header" onClick={() => toggleStore(store.id)}>
                    <div className="store-info">
                      <span className="store-icon">
                        {expandedStore === store.id ? '📂' : '📁'}
                      </span>
                      <div className="store-details">
                        <h3>{store.display_name || store.id}</h3>
                        <p className="store-meta">
                          Created: {formatDate(store.created_at)}
                          {store.file_count && ` • ${store.file_count} file(s)`}
                        </p>
                      </div>
                    </div>
                    <div className="store-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="delete-store-btn"
                        onClick={() => deleteStore(store.id)}
                        title="Delete entire store"
                      >
                        🗑️ Delete Store
                      </button>
                    </div>
                  </div>

                  {expandedStore === store.id && (
                    <div className="store-files">
                      {!storeFiles[store.id] ? (
                        <div className="loading-files">Loading files...</div>
                      ) : storeFiles[store.id].length === 0 ? (
                        <div className="no-files">No files in this store</div>
                      ) : (
                        <table className="files-table">
                          <thead>
                            <tr>
                              <th>File Name</th>
                              <th>Size</th>
                              <th>Uploaded</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {storeFiles[store.id].map((file) => (
                              <tr key={file.name}>
                                <td className="file-name">
                                  <span className="file-icon">📄</span>
                                  {file.name}
                                </td>
                                <td>{formatSize(file.size)}</td>
                                <td>{formatDate(file.create_time)}</td>
                                <td>
                                  <button
                                    className="delete-file-btn"
                                    onClick={() => deleteFile(store.id, file.name)}
                                    title="Delete this file"
                                  >
                                    🗑️
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StoreManager
