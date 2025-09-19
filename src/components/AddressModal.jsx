import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
import './styles/AddressModal.css';

const AddressModal = ({ 
  isOpen, 
  onClose, 
  onSelectAddress, 
  selectedAddressId, 
  title = "Select Address",
  allowSave = true
}) => {
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: '',
    type: 'shipping',
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
    if (isOpen) {
      fetchSavedAddresses();
    }
  }, [isOpen]);

  const fetchSavedAddresses = async () => {
    setLoading(true);
    try {
      const result = await apiService.getAddresses();
      if (result.success) {
        setSavedAddresses(result.data);
      }
    } catch (error) {
      console.error('Error fetching saved addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSelect = (addressId) => {
    const selectedAddress = savedAddresses.find(addr => addr._id === addressId);
    if (selectedAddress) {
      onSelectAddress(selectedAddress);
      onClose();
    }
  };


  const handleSaveNewAddress = async () => {
    try {
      const result = await apiService.createAddress(newAddress);
      if (result.success) {
        await fetchSavedAddresses();
        setShowAddForm(false);
        setNewAddress({
          label: '',
          type: 'shipping',
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
        alert('Address saved successfully!');
      } else {
        alert(`Failed to save address: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving address:', error);
      alert('Failed to save address. Please try again.');
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (window.confirm('Are you sure you want to delete this address?')) {
      try {
        const result = await apiService.deleteAddress(addressId);
        if (result.success) {
          await fetchSavedAddresses();
          alert('Address deleted successfully!');
        } else {
          alert(`Failed to delete address: ${result.error}`);
        }
      } catch (error) {
        console.error('Error deleting address:', error);
        alert('Failed to delete address. Please try again.');
      }
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      const result = await apiService.setDefaultAddress(addressId);
      if (result.success) {
        await fetchSavedAddresses();
        alert('Address set as default!');
      } else {
        alert(`Failed to set default address: ${result.error}`);
      }
    } catch (error) {
      console.error('Error setting default address:', error);
      alert('Failed to set default address. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="address-modal-overlay">
      <div className="address-modal">
        <div className="address-modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="address-modal-content">
          {loading ? (
            <div className="loading">Loading addresses...</div>
          ) : (
            <>
              {/* Saved Addresses */}
              {savedAddresses.length > 0 && (
                <div className="saved-addresses-section">
                  <h3>Saved Addresses</h3>
                  <div className="address-list">
                    {savedAddresses.map((address) => (
                      <div key={address._id} className="address-item">
                        <div className="address-info">
                          <div className="address-header">
                            {address.contactInfo.firstName && address.contactInfo.lastName && (
                              <span className="recipient-name">{address.contactInfo.firstName} {address.contactInfo.lastName}</span>
                            )}
                            {address.label && <span className="address-label">{address.label}</span>}
                            {address.isDefault && <span className="default-badge">Default</span>}
                          </div>
                          <div className="address-details">
                            {address.address.street}
                            {address.address.apartment && `, ${address.address.apartment}`}
                            <br />
                            {address.address.city}, {address.address.state} {address.address.zipCode}
                          </div>
                        </div>
                        <div className="address-actions">
                          <button 
                            className="select-btn"
                            onClick={() => handleAddressSelect(address._id)}
                          >
                            Select
                          </button>
                          {allowSave && (
                            <>
                              <button 
                                className="default-btn"
                                onClick={() => handleSetDefault(address._id)}
                                disabled={address.isDefault}
                              >
                                {address.isDefault ? 'Default' : 'Set Default'}
                              </button>
                              <button 
                                className="delete-btn"
                                onClick={() => handleDeleteAddress(address._id)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Address Option */}
              {allowSave && (
                <div className="save-address-section">
                  <button 
                    className="save-address-btn"
                    onClick={() => setShowAddForm(!showAddForm)}
                  >
                    {showAddForm ? 'Cancel' : 'Add New Address'}
                  </button>
                  
                  {showAddForm && (
                    <div className="save-address-form">
                      <h4>Add New Address</h4>
                      <div className="form-group">
                        <input
                          type="text"
                          placeholder="Address Label (optional, e.g., Home, Work)"
                          value={newAddress.label}
                          onChange={(e) => setNewAddress({...newAddress, label: e.target.value})}
                        />
                      </div>
                      <div className="form-row">
                        <input
                          type="text"
                          placeholder="Contact First Name"
                          value={newAddress.contactInfo.firstName}
                          onChange={(e) => setNewAddress({
                            ...newAddress, 
                            contactInfo: {...newAddress.contactInfo, firstName: e.target.value}
                          })}
                          required
                        />
                        <input
                          type="text"
                          placeholder="Contact Last Name"
                          value={newAddress.contactInfo.lastName}
                          onChange={(e) => setNewAddress({
                            ...newAddress, 
                            contactInfo: {...newAddress.contactInfo, lastName: e.target.value}
                          })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="text"
                          placeholder="Street Address"
                          value={newAddress.address.street}
                          onChange={(e) => setNewAddress({
                            ...newAddress, 
                            address: {...newAddress.address, street: e.target.value}
                          })}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="text"
                          placeholder="Apartment/Suite (optional)"
                          value={newAddress.address.apartment}
                          onChange={(e) => setNewAddress({
                            ...newAddress, 
                            address: {...newAddress.address, apartment: e.target.value}
                          })}
                        />
                      </div>
                      <div className="form-row">
                        <input
                          type="text"
                          placeholder="City"
                          value={newAddress.address.city}
                          onChange={(e) => setNewAddress({
                            ...newAddress, 
                            address: {...newAddress.address, city: e.target.value}
                          })}
                          required
                        />
                        <input
                          type="text"
                          placeholder="State"
                          value={newAddress.address.state}
                          onChange={(e) => setNewAddress({
                            ...newAddress, 
                            address: {...newAddress.address, state: e.target.value}
                          })}
                          required
                        />
                      </div>
                      <div className="form-row">
                        <input
                          type="text"
                          placeholder="ZIP Code"
                          value={newAddress.address.zipCode}
                          onChange={(e) => setNewAddress({
                            ...newAddress, 
                            address: {...newAddress.address, zipCode: e.target.value}
                          })}
                          required
                        />
                        <input
                          type="text"
                          placeholder="Country"
                          value={newAddress.address.country}
                          onChange={(e) => setNewAddress({
                            ...newAddress, 
                            address: {...newAddress.address, country: e.target.value}
                          })}
                        />
                      </div>
                      <div className="form-group">
                        <input
                          type="text"
                          placeholder="Phone Number (optional)"
                          value={newAddress.contactInfo.phone}
                          onChange={(e) => setNewAddress({
                            ...newAddress, 
                            contactInfo: {...newAddress.contactInfo, phone: e.target.value}
                          })}
                        />
                      </div>
                      <div className="form-group">
                        <textarea
                          placeholder="Delivery Instructions (optional)"
                          value={newAddress.instructions}
                          onChange={(e) => setNewAddress({...newAddress, instructions: e.target.value})}
                          rows="3"
                        />
                      </div>
                      <div className="form-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={newAddress.isDefault}
                            onChange={(e) => setNewAddress({...newAddress, isDefault: e.target.checked})}
                          />
                          Set as default shipping address
                        </label>
                      </div>
                      <button 
                        className="save-btn"
                        onClick={handleSaveNewAddress}
                        disabled={!newAddress.contactInfo.firstName || !newAddress.contactInfo.lastName || !newAddress.address.street || !newAddress.address.city || !newAddress.address.state || !newAddress.address.zipCode}
                      >
                        Save Address
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddressModal;
