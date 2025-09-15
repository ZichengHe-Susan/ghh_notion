import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../css/login.scss'; 
import { Typography, Button, TextField, Grid, Link, Box, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom'; 
import Home from './Home';
import Item from '../Item';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const navigate = useNavigate(); 
  const { login, register } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const result = await login(email, password);
      if (result.success) {
        setError('Login successful');
        navigate('/'); 
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const userData = {
        email,
        password,
        firstName: firstName || displayName || email.split('@')[0], // Ensure we always have a firstName
        lastName: lastName || 'User', // Ensure we always have a lastName
        role: 'user'
      };

      console.log('Preparing registration data:', userData);
      const result = await register(userData);
      if (result.success) {
        setError('Registration successful');
        navigate('/');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  };

  return (
    <div className="login-container">
      <div className="login-image">
      </div>

      <div className="login-form">
        <Typography variant="h2" className="welcome-text">
          Welcome to UVA Thrift Store
        </Typography>
        <h2 className="slogan">
          {isRegistering
            ? 'Join the UVA Thrift Community – Reduce, Reuse, and Reimagine'
            : 'Discover Unique Finds & Reduce Waste by Thrifting'}
        </h2>
        <form onSubmit={isRegistering ? handleRegister : handleLogin}>
          <div className="form-group">
          {isRegistering && (
            <>
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder='Enter Your First Name'
                  autoComplete="given-name"
                  required
                /> 
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder='Enter Your Last Name'
                  autoComplete="family-name"
                  required
                /> 
              </div>
              <div className="form-group">
                <label>Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder='Enter Your Display Name'
                  autoComplete="username"
                  required
                /> 
              </div>
            </>
              )
            }
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='Your Email'
              autoComplete="email"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegistering ? 'Password (min 6 chars, 1 uppercase, 1 lowercase, 1 number)' : 'Your Password'}
              autoComplete={isRegistering ? "new-password" : "current-password"}
              required
            />
            {isRegistering && (
              <small style={{ color: '#666', fontSize: '12px' }}>
                Password must be at least 6 characters with uppercase, lowercase, and number
              </small>
            )}
          </div>


          {error && <p className="error-message">{error}</p>}
          <div className="form-group">
            <button type="submit" className="login-button">
              {isRegistering ? 'Register' : 'Sign in'}
            </button>
          </div>
        </form>
        <div className="login-footer">
          <p>
            {isRegistering
              ? 'Already have an account?'
              : "Don't have an account?"}
            <button
              className="toggle-button"
              onClick={() => setIsRegistering(!isRegistering)}
            >
              {isRegistering ? 'Login' : 'Register'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;