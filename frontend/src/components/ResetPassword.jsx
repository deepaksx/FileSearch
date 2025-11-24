import { useState } from 'react';
import { resetPassword, requestPasswordReset } from '../utils/api';
import logo from '../assets/logo.png';
import './Login.css';

function ResetPassword({ email, onResetSuccess, onBackToLogin }) {
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(email, otpCode, newPassword);
      setSuccess('Password reset successfully!');
      setTimeout(() => {
        onResetSuccess();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setSuccess('');
    setResending(true);

    try {
      const response = await requestPasswordReset(email);
      setSuccess('Reset code resent to your email!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <img src={logo} alt="NXSYS Logo" className="login-logo" />
          <h1>Reset Your Password</h1>
          <p>Enter the code sent to {email}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          {success && (
            <div className="login-success" style={{
              padding: '10px',
              backgroundColor: '#d4edda',
              color: '#155724',
              border: '1px solid #c3e6cb',
              borderRadius: '4px',
              marginBottom: '15px'
            }}>
              {success}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="otpCode">Reset Code</label>
            <input
              type="text"
              id="otpCode"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              required
              autoFocus
              maxLength={6}
              pattern="\d{6}"
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={loading || otpCode.length !== 6}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>

          <div style={{ marginTop: '15px', textAlign: 'center', display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={resending}
              style={{
                background: 'none',
                border: 'none',
                color: '#007bff',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '14px'
              }}
            >
              {resending ? 'Resending...' : 'Resend Code'}
            </button>
            <button
              type="button"
              onClick={onBackToLogin}
              style={{
                background: 'none',
                border: 'none',
                color: '#007bff',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '14px'
              }}
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
