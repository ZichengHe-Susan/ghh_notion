import React, { useState, useEffect } from 'react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import apiService from '../services/api';
import './styles/PaymentMethodManager.css';

const PaymentMethodManager = ({ onPaymentMethodSelect, onPaymentMethodAdded }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      const result = await apiService.getPaymentMethods();
      if (result.success) {
        setPaymentMethods(result.data.paymentMethods || []);
      } else {
        setError('Failed to load payment methods');
      }
    } catch (err) {
      setError('Error loading payment methods');
      console.error('Payment methods fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethodSelect = (method) => {
    setSelectedMethod(method);
    if (onPaymentMethodSelect) {
      onPaymentMethodSelect(method);
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId) => {
    try {
      const result = await apiService.removePaymentMethod(paymentMethodId);
      if (result.success) {
        setPaymentMethods(prev => 
          prev.filter(pm => pm.id !== paymentMethodId)
        );
        if (selectedMethod && selectedMethod.id === paymentMethodId) {
          setSelectedMethod(null);
        }
      } else {
        alert('Failed to remove payment method');
      }
    } catch (err) {
      alert('Error removing payment method');
      console.error('Remove payment method error:', err);
    }
  };

  const formatCardNumber = (last4) => `•••• •••• •••• ${last4}`;

  if (loading) {
    return (
      <div className="payment-method-manager">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading payment methods...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-method-manager">
      <h3>Saved Payment Methods</h3>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {paymentMethods.length === 0 ? (
        <div className="no-payment-methods">
          <p>No saved payment methods found.</p>
          <p className="help-text">Payment methods will be saved automatically after successful payments.</p>
        </div>
      ) : (
        <div className="payment-methods-list">
          {paymentMethods.map((method) => (
            <div 
              key={method.id} 
              className={`payment-method-item ${selectedMethod?.id === method.id ? 'selected' : ''}`}
              onClick={() => handlePaymentMethodSelect(method)}
            >
              <div className="card-info">
                <div className="card-brand">
                  <img 
                    src={`/card-brands/${method.card.brand}.svg`} 
                    alt={method.card.brand}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <span className="brand-name">
                    {method.card.brand.charAt(0).toUpperCase() + method.card.brand.slice(1)}
                  </span>
                </div>
                
                <div className="card-details">
                  <div className="card-number">
                    {formatCardNumber(method.card.last4)}
                  </div>
                  
                  <div className="card-expiry">
                    Expires {method.card.exp_month}/{method.card.exp_year}
                  </div>
                </div>
                
                {method.card.funding && (
                  <div className="card-funding">
                    {method.card.funding}
                  </div>
                )}
              </div>
              
              <div className="card-actions">
                <button
                  type="button"
                  className="remove-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Are you sure you want to remove this payment method?')) {
                      handleRemovePaymentMethod(method.id);
                    }
                  }}
                  title="Remove payment method"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {paymentMethods.length > 0 && onPaymentMethodAdded && (
        <div className="add-payment-method">
          <button 
            type="button" 
            className="add-new-method-btn"
            onClick={onPaymentMethodAdded}
          >
            + Add New Payment Method
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentMethodManager;
