import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import './styles/AddressBookEditor.css';

const AddressBookEditor = () => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [formData, setFormData] = useState({
    label: '',
    type: 'home',
    address: {
      street: '',
      apartment: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA'
    },
    contactInfo: {
      firstName: '',
      lastName: '',
      phone: ''
    },
    instructions: '',
    isDefault: false
  });

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const response = await api.getAddresses();
      if (response.success) {
        setAddresses(response.data);
      } else {
        setMessage({ 
          type: 'error', 
          text: response.error || 'Failed to load addresses' 
        });
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to load addresses' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
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
      let response;
      if (editingAddress) {
        // Update existing address
        response = await api.updateAddress(editingAddress._id, formData);
      } else {
        // Create new address
        response = await api.createAddress(formData);
      }

      if (response.success) {
        setMessage({ 
          type: 'success', 
          text: editingAddress ? 'Address updated successfully!' : 'Address added successfully!' 
        });
        resetForm();
        fetchAddresses();
      } else {
        setMessage({ 
          type: 'error', 
          text: response.error || 'Failed to save address' 
        });
      }
    } catch (error) {
      console.error('Error saving address:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to save address' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (address) => {
    setFormData({
      label: address.label || '',
      type: address.type || 'home',
      address: {
        street: address.address.street || '',
        apartment: address.address.apartment || '',
        city: address.address.city || '',
        state: address.address.state || '',
        zipCode: address.address.zipCode || '',
        country: address.address.country || 'USA'
      },
      contactInfo: {
        firstName: address.contactInfo?.firstName || '',
        lastName: address.contactInfo?.lastName || '',
        phone: address.contactInfo?.phone || ''
      },
      instructions: address.instructions || '',
      isDefault: address.isDefault || false
    });
    setEditingAddress(address);
    setShowAddForm(true);
  };

  const handleDelete = async (addressId) => {
    if (!window.confirm('Are you sure you want to delete this address?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await api.deleteAddress(addressId);
      
      if (response.success) {
        setMessage({ 
          type: 'success', 
          text: 'Address deleted successfully!' 
        });
        fetchAddresses();
      } else {
        setMessage({ 
          type: 'error', 
          text: response.error || 'Failed to delete address' 
        });
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to delete address' 
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      label: '',
      type: 'home',
      address: {
        street: '',
        apartment: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'USA'
      },
      contactInfo: {
        firstName: '',
        lastName: '',
        phone: ''
      },
      instructions: '',
      isDefault: false
    });
    setEditingAddress(null);
    setShowAddForm(false);
  };

  const handleCancel = () => {
    resetForm();
    setMessage({ type: '', text: '' });
  };

  if (loading && addresses.length === 0) {
    return <div className="address-book-editor">Loading addresses...</div>;
  }

  return (
    <div className="address-book-editor">
      <div className="address-book-editor__header">
        <h3>Address Book</h3>
        <p className="address-book-editor__description">
          Manage your shipping and billing addresses
        </p>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn btn--primary"
          disabled={loading}
        >
          Add New Address
        </button>
      </div>

      {message.text && (
        <div className={`message message--${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Address List */}
      <div className="address-list">
        {addresses.length === 0 ? (
          <div className="empty-state">
            <p>No addresses found. Add your first address to get started.</p>
          </div>
        ) : (
          addresses.map((address) => (
            <div key={address._id} className="address-card">
              <div className="address-card__header">
                <div className="address-card__title">
                  <h4>{address.label || `${address.type.charAt(0).toUpperCase() + address.type.slice(1)} Address`}</h4>
                  {address.isDefault && (
                    <span className="default-badge">Default</span>
                  )}
                </div>
                <div className="address-card__actions">
                  <button
                    onClick={() => handleEdit(address)}
                    className="btn btn--small btn--secondary"
                    disabled={loading}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(address._id)}
                    className="btn btn--small btn--danger"
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </div>
              
              <div className="address-card__content">
                <div className="address-info">
                  {address.contactInfo?.firstName && address.contactInfo?.lastName && (
                    <p className="contact-name">
                      {address.contactInfo.firstName} {address.contactInfo.lastName}
                    </p>
                  )}
                  <p className="street-address">
                    {address.address.street}
                    {address.address.apartment && `, ${address.address.apartment}`}
                  </p>
                  <p className="city-state-zip">
                    {address.address.city}, {address.address.state} {address.address.zipCode}
                  </p>
                  {address.address.country && address.address.country !== 'USA' && (
                    <p className="country">{address.address.country}</p>
                  )}
                  {address.contactInfo?.phone && (
                    <p className="phone">Phone: {address.contactInfo.phone}</p>
                  )}
                  {address.instructions && (
                    <p className="instructions">
                      <strong>Instructions:</strong> {address.instructions}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="address-form-section">
          <div className="address-form-section__header">
            <h3>{editingAddress ? 'Edit Address' : 'Add New Address'}</h3>
            <button
              onClick={handleCancel}
              className="btn btn--small btn--secondary"
              disabled={loading}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="address-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="label" className="form-label">
                  Label (Optional)
                </label>
                <input
                  type="text"
                  id="label"
                  name="label"
                  value={formData.label}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="e.g., Home, Work"
                  maxLength="50"
                />
              </div>

              <div className="form-group">
                <label htmlFor="type" className="form-label">
                  Address Type
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="home">Home</option>
                  <option value="work">Work</option>
                  <option value="billing">Billing</option>
                  <option value="shipping">Shipping</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="street" className="form-label">
                Street Address *
              </label>
              <input
                type="text"
                id="street"
                name="address.street"
                value={formData.address.street}
                onChange={handleChange}
                className="form-input"
                required
                maxLength="200"
              />
            </div>

            <div className="form-group">
              <label htmlFor="apartment" className="form-label">
                Apartment/Suite (Optional)
              </label>
              <input
                type="text"
                id="apartment"
                name="address.apartment"
                value={formData.address.apartment}
                onChange={handleChange}
                className="form-input"
                maxLength="50"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="city" className="form-label">
                  City *
                </label>
                <input
                  type="text"
                  id="city"
                  name="address.city"
                  value={formData.address.city}
                  onChange={handleChange}
                  className="form-input"
                  required
                  maxLength="100"
                />
              </div>

              <div className="form-group">
                <label htmlFor="state" className="form-label">
                  State *
                </label>
                <input
                  type="text"
                  id="state"
                  name="address.state"
                  value={formData.address.state}
                  onChange={handleChange}
                  className="form-input"
                  required
                  maxLength="100"
                />
              </div>

              <div className="form-group">
                <label htmlFor="zipCode" className="form-label">
                  ZIP Code *
                </label>
                <input
                  type="text"
                  id="zipCode"
                  name="address.zipCode"
                  value={formData.address.zipCode}
                  onChange={handleChange}
                  className="form-input"
                  required
                  maxLength="20"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="country" className="form-label">
                Country
              </label>
              <input
                type="text"
                id="country"
                name="address.country"
                value={formData.address.country}
                onChange={handleChange}
                className="form-input"
                maxLength="100"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName" className="form-label">
                  Contact First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="contactInfo.firstName"
                  value={formData.contactInfo.firstName}
                  onChange={handleChange}
                  className="form-input"
                  maxLength="50"
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastName" className="form-label">
                  Contact Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="contactInfo.lastName"
                  value={formData.contactInfo.lastName}
                  onChange={handleChange}
                  className="form-input"
                  maxLength="50"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone" className="form-label">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="contactInfo.phone"
                  value={formData.contactInfo.phone}
                  onChange={handleChange}
                  className="form-input"
                  maxLength="20"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="instructions" className="form-label">
                Delivery Instructions (Optional)
              </label>
              <textarea
                id="instructions"
                name="instructions"
                value={formData.instructions}
                onChange={handleChange}
                className="form-textarea"
                rows="3"
                maxLength="500"
                placeholder="Any special delivery instructions..."
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault}
                  onChange={handleChange}
                  className="checkbox-input"
                />
                <span className="checkbox-text">Set as default address for this type</span>
              </label>
            </div>

            <div className="address-form__actions">
              <button
                type="submit"
                disabled={loading}
                className="btn btn--primary"
              >
                {loading ? 'Saving...' : (editingAddress ? 'Update Address' : 'Add Address')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="btn btn--secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AddressBookEditor;
