import { useState } from 'react';
import { sendVerificationOTP, verifyEmail } from '../utils/api';
import logo from '../assets/logo.png';
import './Login.css';

function VerifyEmail({ email, onVerificationSuccess }) {
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await verifyEmail(email, otpCode);
      setSuccess('Email verified successfully!');
      setTimeout(() => {
        onVerificationSuccess();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setSuccess('');
    setResending(true);

    try {
      await sendVerificationOTP(email);
      setSuccess('Verification code resent to your email!');
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
          <h1>Verify Your Email</h1>
          <p>Enter the 6-digit code sent to {email}</p>
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
            <label htmlFor="otpCode">Verification Code</label>
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

          <button
            type="submit"
            className="login-btn"
            disabled={loading || otpCode.length !== 6}
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>

          <div style={{ marginTop: '15px', textAlign: 'center' }}>
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
          </div>
        </form>
      </div>
    </div>
  );
}

export default VerifyEmail;
