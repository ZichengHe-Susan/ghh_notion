import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import apiService from '../services/api';

const EmailVerification = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error', 'alreadyVerified'
  const [message, setMessage] = useState('');
  const hasVerified = useRef(false); // Prevent duplicate verification attempts

  useEffect(() => {
    const token = searchParams.get('token');
    
    console.log('EmailVerification useEffect triggered', {
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
    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token) => {
    console.log('Starting email verification', {
      token: `${token.substring(0, 10)}...`,
      timestamp: new Date().toISOString()
    });

    try {
      console.log('Making API request to verify email');
      const result = await apiService.request(`/auth/verify-email/${token}`, {
        method: 'GET'
      });

      console.log('Email verification API response:', {
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
          console.log('Email verification successful, setting success status');
          setStatus('success');
          setMessage('Email verified successfully! You can now log in.');
        }
      } else {
        console.log('Email verification failed:', result.error);
        setStatus('error');
        setMessage(result.error || 'Email verification failed');
      }
    } catch (error) {
      console.error('Email verification error caught:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      setStatus('error');
      setMessage('Email verification failed. Please try again.');
    }
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleHome = () => {
    navigate('/');
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '90%'
      }}>
        {status === 'verifying' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <h2 style={{ color: '#333', marginBottom: '20px' }}>Verifying Email...</h2>
            <p style={{ color: '#666' }}>Please wait while we verify your email address.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
            <h2 style={{ color: '#28a745', marginBottom: '20px' }}>Email Verified!</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>{message}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                onClick={handleLogin}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Go to Login
              </button>
              <button 
                onClick={handleHome}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Go to Home
              </button>
            </div>
          </>
        )}

        {status === 'alreadyVerified' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>ℹ️</div>
            <h2 style={{ color: '#17a2b8', marginBottom: '20px' }}>Already Verified</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>{message}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                onClick={handleLogin}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Go to Login
              </button>
              <button 
                onClick={handleHome}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Go to Home
              </button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
            <h2 style={{ color: '#dc3545', marginBottom: '20px' }}>Verification Failed</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>{message}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                onClick={handleLogin}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Go to Login
              </button>
              <button 
                onClick={handleHome}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Go to Home
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailVerification;
