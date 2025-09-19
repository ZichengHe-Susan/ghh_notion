import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './styles/ProfileInfoEditor.css';

const ProfileInfoEditor = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    email: '',
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
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        displayName: user.displayName || '',
        email: user.email || '',
        phone: user.profile?.phone || '',
        bio: user.profile?.bio || '',
        location: user.profile?.location || '',
        preferences: {
          notifications: {
            email: user.profile?.preferences?.notifications?.email ?? true,
            push: user.profile?.preferences?.notifications?.push ?? true,
            sms: user.profile?.preferences?.notifications?.sms ?? false
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
      // Determine which API to call based on what's being updated
      const hasBasicInfoChanges = formData.firstName !== (user.firstName || '') || 
                                 formData.lastName !== (user.lastName || '') || 
                                 formData.displayName !== (user.displayName || '') || 
                                 formData.email !== (user.email || '');

      const hasProfileChanges = formData.phone !== (user.profile?.phone || '') || 
                               formData.bio !== (user.profile?.bio || '') || 
                               formData.location !== (user.profile?.location || '') ||
                               JSON.stringify(formData.preferences) !== JSON.stringify(user.profile?.preferences || {});

      // If no changes are detected, show a message and return
      if (!hasBasicInfoChanges && !hasProfileChanges) {
        setMessage({ 
          type: 'error', 
          text: 'No changes detected. Please make changes before saving.' 
        });
        setLoading(false);
        return;
      }

      let response;

      if (hasBasicInfoChanges) {
        // Update basic user information (name, display name, email)
        const basicInfoData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          displayName: formData.displayName
        };
        
        console.log('=== Frontend Debug ===');
        console.log('formData:', formData);
        console.log('user:', user);
        console.log('hasBasicInfoChanges:', hasBasicInfoChanges);
        console.log('basicInfoData:', basicInfoData);

        // Only include email if it's different and password if email is changing
        if (formData.email !== user.email) {
          const password = prompt('Please enter your password to change your email address:');
          if (!password) {
            setMessage({ 
              type: 'error', 
              text: 'Password is required to change email address' 
            });
            setLoading(false);
            return;
          }
          basicInfoData.email = formData.email;
          basicInfoData.password = password;
        }

        response = await api.updateUserInfo(basicInfoData);
      } else {
        // Update profile information only
        response = await api.updateProfile({
          phone: formData.phone,
          bio: formData.bio,
          location: formData.location,
          preferences: formData.preferences
        });
      }

      if (response.success) {
        // Update the user context with new data
        updateUser({
          ...user,
          firstName: formData.firstName,
          lastName: formData.lastName,
          displayName: formData.displayName,
          email: formData.email,
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
        let errorMessage = response.error || 'Failed to update profile information';
        
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
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        displayName: user.displayName || '',
        email: user.email || '',
        phone: user.profile?.phone || '',
        bio: user.profile?.bio || '',
        location: user.profile?.location || '',
        preferences: {
          notifications: {
            email: user.profile?.preferences?.notifications?.email ?? true,
            push: user.profile?.preferences?.notifications?.push ?? true,
            sms: user.profile?.preferences?.notifications?.sms ?? false
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
        {isEditing && (
          <div className="edit-mode-indicator">
            <span className="edit-mode-badge">✏️ Edit Mode</span>
            <span className="edit-mode-text">You can now edit your profile information</span>
          </div>
        )}
      </div>

      {message.text && (
        <div className={`message message--${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="profile-info-editor__form">
        <div className="form-section">
          <h4 className="form-section__title">Basic Information</h4>
          
          <div className="form-row">
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
                placeholder="Enter your first name"
                maxLength="50"
                required
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
                placeholder="Enter your last name"
                maxLength="50"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="displayName" className="form-label">
              Display Name
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              disabled={!isEditing}
              className="form-input"
              placeholder="How you want to appear to other users"
              maxLength="50"
            />
            <div className="form-help">
              This is how your name will appear to other users. If left empty, it will use your first and last name.
            </div>
          </div>

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
              placeholder="Enter your email address"
              required
            />
            <div className="form-help">
              Changing your email will require password verification and reset your email verification status.
            </div>
          </div>
        </div>

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
          <li><strong>First and Last Name:</strong> Required fields used for account identification</li>
          <li><strong>Display Name:</strong> Optional custom name shown to other users (defaults to first + last name)</li>
          <li><strong>Email:</strong> Required for account access and notifications (password required to change)</li>
          <li><strong>Phone Number:</strong> Helps with order communication and delivery</li>
          <li><strong>Location:</strong> Helps other users find items nearby</li>
          <li><strong>Bio:</strong> Helps other users get to know you better</li>
          <li><strong>Notification Preferences:</strong> Control how you receive updates</li>
          <li>All profile information can be updated anytime except email (requires password verification)</li>
        </ul>
      </div>
    </div>
  );
};

export default ProfileInfoEditor;
