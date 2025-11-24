import { useState, useEffect } from 'react';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import VerifyEmail from './components/VerifyEmail';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import { getCurrentUser } from './utils/api';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState('login'); // login, verify-email, forgot-password, reset-password
  const [tempEmail, setTempEmail] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const data = await getCurrentUser();
        setUser(data.user);
      } catch (err) {
        console.error('Auth check failed:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setAuthView('login');
  };

  const handleLogout = () => {
    setUser(null);
    setAuthView('login');
  };

  const handleForgotPassword = () => {
    setAuthView('forgot-password');
  };

  const handleBackToLogin = () => {
    setAuthView('login');
    setTempEmail('');
  };

  const handleOTPSent = (email) => {
    setTempEmail(email);
    setAuthView('reset-password');
  };

  const handleResetSuccess = () => {
    setAuthView('login');
    setTempEmail('');
  };

  const handleVerificationSuccess = () => {
    setAuthView('login');
    setTempEmail('');
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    // Handle different authentication views
    if (authView === 'verify-email' && tempEmail) {
      return (
        <VerifyEmail
          email={tempEmail}
          onVerificationSuccess={handleVerificationSuccess}
        />
      );
    }

    if (authView === 'forgot-password') {
      return (
        <ForgotPassword
          onBackToLogin={handleBackToLogin}
          onOTPSent={handleOTPSent}
        />
      );
    }

    if (authView === 'reset-password' && tempEmail) {
      return (
        <ResetPassword
          email={tempEmail}
          onResetSuccess={handleResetSuccess}
          onBackToLogin={handleBackToLogin}
        />
      );
    }

    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onForgotPassword={handleForgotPassword}
      />
    );
  }

  if (user.role === 'admin') {
    return <AdminDashboard user={user} onLogout={handleLogout} />;
  }

  return <UserDashboard user={user} onLogout={handleLogout} />;
}

export default App;
