import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import './styles/ProfileInfoEditor.css';

const ProfileInfoEditor = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    phone: '',
    bio: '',
    location: '',
    preferences: {
      notifications: {
        email: true,
        push: true,
        sms: false
      }
    }
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user && user.profile) {
      setFormData({
        phone: user.profile.phone || '',
        bio: user.profile.bio || '',
        location: user.profile.location || '',
        preferences: {
          notifications: {
            email: user.profile.preferences?.notifications?.email ?? true,
            push: user.profile.preferences?.notifications?.push ?? true,
            sms: user.profile.preferences?.notifications?.sms ?? false
          }
        }
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child, grandchild] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: {
            ...prev[parent][child],
            [grandchild]: type === 'checkbox' ? checked : value
          }
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.updateProfile({
        phone: formData.phone,
        bio: formData.bio,
        location: formData.location,
        preferences: formData.preferences
      });

      if (response.success) {
        // Update the user context with new data
        updateUser({
          ...user,
          profile: {
            ...user.profile,
            phone: formData.phone,
            bio: formData.bio,
            location: formData.location,
            preferences: formData.preferences
          }
        });

        setMessage({ 
          type: 'success', 
          text: 'Profile information updated successfully!' 
        });
        setIsEditing(false);
      } else {
        setMessage({ 
          type: 'error', 
          text: response.error || 'Failed to update profile information' 
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to update profile information' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (user && user.profile) {
      setFormData({
        phone: user.profile.phone || '',
        bio: user.profile.bio || '',
        location: user.profile.location || '',
        preferences: {
          notifications: {
            email: user.profile.preferences?.notifications?.email ?? true,
            push: user.profile.preferences?.notifications?.push ?? true,
            sms: user.profile.preferences?.notifications?.sms ?? false
          }
        }
      });
    }
    setIsEditing(false);
    setMessage({ type: '', text: '' });
  };

  if (!user) {
    return <div className="profile-info-editor">Loading...</div>;
  }

  return (
    <div className="profile-info-editor">
      <div className="profile-info-editor__header">
        <h3>Profile Information</h3>
        <p className="profile-info-editor__description">
          Update your personal information and preferences
        </p>
      </div>

      {message.text && (
        <div className={`message message--${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="profile-info-editor__form">
        <div className="form-section">
          <h4 className="form-section__title">Contact Information</h4>
          
          <div className="form-group">
            <label htmlFor="phone" className="form-label">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={!isEditing}
              className="form-input"
              placeholder="Enter your phone number"
              maxLength="20"
            />
          </div>

          <div className="form-group">
            <label htmlFor="location" className="form-label">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              disabled={!isEditing}
              className="form-input"
              placeholder="Enter your location"
              maxLength="100"
            />
          </div>
        </div>

        <div className="form-section">
          <h4 className="form-section__title">About You</h4>
          
          <div className="form-group">
            <label htmlFor="bio" className="form-label">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              disabled={!isEditing}
              className="form-textarea"
              placeholder="Tell us about yourself..."
              rows="4"
              maxLength="500"
            />
            <div className="form-help">
              {formData.bio.length}/500 characters
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4 className="form-section__title">Notification Preferences</h4>
          
          <div className="preferences-grid">
            <div className="preference-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="preferences.notifications.email"
                  checked={formData.preferences.notifications.email}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="checkbox-input"
                />
                <span className="checkbox-text">
                  <strong>Email Notifications</strong>
                  <small>Receive updates via email</small>
                </span>
              </label>
            </div>

            <div className="preference-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="preferences.notifications.push"
                  checked={formData.preferences.notifications.push}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="checkbox-input"
                />
                <span className="checkbox-text">
                  <strong>Push Notifications</strong>
                  <small>Receive browser notifications</small>
                </span>
              </label>
            </div>

            <div className="preference-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="preferences.notifications.sms"
                  checked={formData.preferences.notifications.sms}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="checkbox-input"
                />
                <span className="checkbox-text">
                  <strong>SMS Notifications</strong>
                  <small>Receive text message updates</small>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="profile-info-editor__actions">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn btn--primary"
            >
              Edit Profile Information
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

      <div className="profile-info-editor__info">
        <h4>Profile Information Guidelines</h4>
        <ul>
          <li>Your phone number helps with order communication and delivery</li>
          <li>Location information helps other users find items nearby</li>
          <li>Bio helps other users get to know you better</li>
          <li>Notification preferences control how you receive updates</li>
          <li>All information is optional and can be updated anytime</li>
        </ul>
      </div>
    </div>
  );
};

export default ProfileInfoEditor;
