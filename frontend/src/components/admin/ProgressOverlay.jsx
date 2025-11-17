import './ProgressOverlay.css';

function ProgressOverlay({ progress, fileCount, currentFile }) {
  return (
    <div className="progress-overlay">
      <div className="progress-modal">
        <h3>Uploading Files</h3>
        <div className="progress-info">
          <p>
            {currentFile ? `Uploading: ${currentFile}` : 'Preparing upload...'}
          </p>
          {fileCount > 0 && (
            <p className="file-count">{fileCount} file(s) selected</p>
          )}
        </div>
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="progress-percentage">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}

export default ProgressOverlay;
