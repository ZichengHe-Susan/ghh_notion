import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './styles/UsernameEditor.css';

const UsernameEditor = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || ''
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
      const response = await api.updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName
      });

      if (response.success) {
        // Update the user context with new data
        updateUser({
          ...user,
          firstName: formData.firstName,
          lastName: formData.lastName
        });

        setMessage({ 
          type: 'success', 
          text: 'Display name updated successfully!' 
        });
        setIsEditing(false);
      } else {
        setMessage({ 
          type: 'error', 
          text: response.error || 'Failed to update display name' 
        });
      }
    } catch (error) {
      console.error('Error updating display name:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to update display name' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || ''
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
        <h3>Display Name & Email</h3>
        <p className="username-editor__description">
          Update your display name and view your email address
        </p>
      </div>

      {message.text && (
        <div className={`message message--${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="username-editor__form">
        <div className="form-group">
          <label htmlFor="firstName" className="form-label">
            First Name *
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            disabled={!isEditing}
            className="form-input"
            required
            maxLength="50"
          />
        </div>

        <div className="form-group">
          <label htmlFor="lastName" className="form-label">
            Last Name *
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            disabled={!isEditing}
            className="form-input"
            required
            maxLength="50"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            disabled
            className="form-input form-input--disabled"
            readOnly
          />
          <p className="form-help">
            Email address cannot be changed. Contact support if you need to update your email.
          </p>
        </div>

        <div className="username-editor__actions">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn btn--primary"
            >
              Edit Display Name
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
        <h4>Display Name Information</h4>
        <ul>
          <li>Your display name appears on your profile and in communications</li>
          <li>First and last names are required fields</li>
          <li>Email address is used for login and cannot be changed</li>
          <li>Changes may take a few moments to appear across the platform</li>
        </ul>
      </div>
    </div>
  );
};

export default UsernameEditor;
