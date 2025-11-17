import { useState } from 'react'
import axios from 'axios'
import './FileUpload.css'

function FileUpload({ onUploadSuccess }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files)
    setFiles(selectedFiles)
    setError(null)
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    setFiles(droppedFiles)
    setError(null)
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one file')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data.success) {
        onUploadSuccess(response.data)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  return (
    <div className="file-upload">
      <div
        className={`upload-area ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📁</div>
        <h2>Upload Your Files</h2>
        <p>Drag and drop files here, or click to browse</p>
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          className="file-input"
          id="file-input"
          accept=".txt,.pdf,.docx,.json,.py,.js,.md,.csv,.html,.xml"
        />
        <label htmlFor="file-input" className="browse-btn">
          Browse Files
        </label>
        <p className="supported-formats">
          Supported: PDF, DOCX, TXT, JSON, Markdown, CSV, HTML, XML, and code files
        </p>
      </div>

      {files.length > 0 && (
        <div className="selected-files">
          <h3>Selected Files ({files.length})</h3>
          <ul>
            {files.map((file, index) => (
              <li key={index}>
                <span className="file-name">
                  <span className="file-icon">📄</span>
                  {file.name}
                  <span className="file-size">
                    ({(file.size / 1024).toFixed(2)} KB)
                  </span>
                </span>
                <button
                  onClick={() => removeFile(index)}
                  className="remove-btn"
                  disabled={uploading}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={handleUpload}
            className="upload-btn"
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : `Upload ${files.length} File${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}
    </div>
  )
}

export default FileUpload
