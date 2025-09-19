import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './styles/EmailVerification.css';

const EmailChangeVerification = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract token from query parameters
  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error', 'alreadyVerified'
  const [message, setMessage] = useState('');
  const hasVerified = useRef(false); // Prevent duplicate verification attempts

  useEffect(() => {
    console.log('EmailChangeVerification useEffect triggered', {
      token: token ? `${token.substring(0, 10)}...` : 'null',
      hasVerified: hasVerified.current,
      status
    });
    
    if (!token) {
      console.log('No token provided, setting error status');
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    if (hasVerified.current) {
      console.log('Verification already attempted, skipping');
      return;
    }

    hasVerified.current = true;
    verifyEmailChange(token);
  }, [token, navigate]);

  const verifyEmailChange = async (token) => {
    console.log('Starting email change verification', {
      token: `${token.substring(0, 10)}...`,
      timestamp: new Date().toISOString()
    });

    try {
      console.log('Making API request to verify email change');
      const result = await api.request(`/auth/verify-email-change/${token}`, {
        method: 'GET'
      });

      console.log('Email change verification API response:', {
        success: result.success,
        alreadyVerified: result.alreadyVerified,
        error: result.error,
        message: result.message
      });

      if (result.success) {
        if (result.alreadyVerified) {
          console.log('Email already verified, setting alreadyVerified status');
          setStatus('alreadyVerified');
          setMessage('Your email is already verified. Please log in to continue.');
        } else {
          console.log('Email change verification successful, setting success status');
          setStatus('success');
          setMessage(result.message || 'Email address changed successfully!');
        }
      } else {
        console.log('Email change verification failed:', result.error);
        setStatus('error');
        // Check if the error is due to token already being used
        if (result.error && result.error.includes('Invalid or expired verification token')) {
          setMessage('This verification link has already been used or has expired. If you successfully changed your email, please try logging in with your new email address.');
        } else {
          setMessage(result.error || 'Email change verification failed');
        }
      }
    } catch (error) {
      console.error('Email change verification error caught:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      setStatus('error');
      // Check if the error is due to token already being used
      if (error.message && error.message.includes('Invalid or expired verification token')) {
        setMessage('This verification link has already been used or has expired. If you successfully changed your email, please try logging in with your new email address.');
      } else {
        setMessage('Email change verification failed. Please try again.');
      }
    }
  };

  const handleRetry = () => {
    setStatus('verifying');
    setMessage('');
    // Retry verification
    window.location.reload();
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="email-verification">
      <div className="email-verification__container">
        <div className="email-verification__content">
          {status === 'verifying' && (
            <div className="verification-status verifying">
              <div className="spinner"></div>
              <h2>Verifying Email Change...</h2>
              <p>Please wait while we verify your new email address.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="verification-status success">
              <div className="success-icon">✓</div>
              <h2>Email Change Successful!</h2>
              <p>{message}</p>
              <div className="verification-actions">
                <button 
                  onClick={handleGoToLogin}
                  className="btn btn--primary"
                >
                  Go to Login
                </button>
              </div>
            </div>
          )}

          {status === 'alreadyVerified' && (
            <div className="verification-status already-verified">
              <div className="info-icon">ℹ️</div>
              <h2>Already Verified</h2>
              <p>{message}</p>
              <div className="verification-actions">
                <button 
                  onClick={handleGoToLogin}
                  className="btn btn--primary"
                >
                  Go to Login
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="verification-status error">
              <div className="error-icon">✗</div>
              <h2>Verification Failed</h2>
              <p>{message}</p>
              <div className="verification-actions">
                {!message.includes('already been used') && (
                  <button 
                    onClick={handleRetry}
                    className="btn btn--secondary"
                  >
                    Try Again
                  </button>
                )}
                <button 
                  onClick={handleGoToLogin}
                  className="btn btn--primary"
                >
                  Go to Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailChangeVerification;
