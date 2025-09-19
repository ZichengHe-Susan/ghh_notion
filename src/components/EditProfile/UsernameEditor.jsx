import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './styles/UsernameEditor.css';

const UsernameEditor = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        password: ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Check if email has changed
      if (formData.email === user.email) {
        setMessage({ 
          type: 'error', 
          text: 'No changes detected. Please enter a new email address.' 
        });
        setLoading(false);
        return;
      }

      // Validate password is provided
      if (!formData.password) {
        setMessage({ 
          type: 'error', 
          text: 'Password is required to change email address' 
        });
        setLoading(false);
        return;
      }

      const response = await api.updateUserInfo({
        email: formData.email,
        password: formData.password
      });

      if (response.success) {
        // Update the user context with new email
        updateUser({
          ...user,
          email: formData.email
        });

        setMessage({ 
          type: 'success', 
          text: 'Email address updated successfully!' 
        });
        setIsEditing(false);
        // Clear password field
        setFormData(prev => ({ ...prev, password: '' }));
      } else {
        let errorMessage = response.error || 'Failed to update email address';
        
        // If there are validation details, show them
        if (response.details && Array.isArray(response.details)) {
          errorMessage = response.details.map(detail => detail.msg || detail.message).join(', ');
        }
        
        setMessage({ 
          type: 'error', 
          text: errorMessage
        });
      }
    } catch (error) {
      console.error('Error updating email:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to update email address' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      email: user.email || '',
      password: ''
    });
    setIsEditing(false);
    setMessage({ type: '', text: '' });
  };

  if (!user) {
    return <div className="username-editor">Loading...</div>;
  }

  return (
    <div className="username-editor">
      <div className="username-editor__header">
        <h3>Email Address</h3>
        <p className="username-editor__description">
          Update your email address for account access and notifications
        </p>
      </div>

      {message.text && (
        <div className={`message message--${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="username-editor__form">
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email Address *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={!isEditing}
            className="form-input"
            placeholder="Enter your new email address"
            required
          />
          <div className="form-help">
            Changing your email will require password verification and reset your email verification status.
          </div>
        </div>

        {isEditing && (
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Current Password *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="form-input"
              placeholder="Enter your current password"
              required
            />
            <div className="form-help">
              Your password is required to verify your identity for email changes.
            </div>
          </div>
        )}

        <div className="username-editor__actions">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn btn--primary"
            >
              Change Email Address
            </button>
          ) : (
            <>
              <button
                type="submit"
                disabled={loading}
                className="btn btn--primary"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="btn btn--secondary"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </form>

      <div className="username-editor__info">
        <h4>Email Address Information</h4>
        <ul>
          <li>Your email address is used for login and account notifications</li>
          <li>Changing your email requires password verification for security</li>
          <li>Email verification will be required after changing your address</li>
          <li>All notifications will be sent to your new email address</li>
        </ul>
      </div>
    </div>
  );
};

export default UsernameEditor;
