import React, { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import apiService from '../services/api';
import './styles/StripePaymentForm.css';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#9e2146',
    },
  },
};

const StripePaymentForm = ({ 
  orderData, 
  totalAmount, 
  pricingBreakdown,
  onSuccess, 
  onError,
  billingDetails = {},
  isLoading: parentIsLoading = false 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [billingInfo, setBillingInfo] = useState({
    name: billingDetails.name || '',
    email: billingDetails.email || '',
    phone: billingDetails.phone || '',
    address: {
      line1: billingDetails.address?.line1 || '',
      line2: billingDetails.address?.line2 || '',
      city: billingDetails.address?.city || '',
      state: billingDetails.address?.state || '',
      postalCode: billingDetails.address?.postalCode || '',
      country: billingDetails.address?.country || 'US'
    }
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements || parentIsLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      
      // Create payment intent on the backend
      const paymentIntentResponse = await apiService.createOrder(orderData);
      if (!paymentIntentResponse.success) {
        throw new Error(paymentIntentResponse.error || 'Failed to create payment intent');
      }

      const { clientSecret, id: paymentIntentId } = paymentIntentResponse.data.paymentIntent;

      // Confirm the payment with Stripe
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: billingInfo.name,
            email: billingInfo.email,
            phone: billingInfo.phone,
            address: {
              line1: billingInfo.address.line1,
              line2: billingInfo.address.line2,
              city: billingInfo.address.city,
              state: billingInfo.address.state,
              postal_code: billingInfo.address.postalCode, // Fix: postalCode -> postal_code
              country: billingInfo.address.country
            },
          },
        },
      });

      console.log('🔄 STRIPE CONFIRMATION RESULT:', {
        error: result.error,
        paymentIntent: result.paymentIntent,
        fullResult: result
      });

      if (result.error) {
        console.error('❌ STRIPE PAYMENT FAILED:', result.error);
        setError(result.error.message);
        if (onError) onError(result.error);
      } else {
        // Payment succeeded
        if (onSuccess) {
          onSuccess({
            paymentIntentId: paymentIntentId,
            clientSecret,
            result: result.paymentIntent,
            orderData: paymentIntentResponse.data.order
          });
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Payment failed. Please try again.';
      setError(errorMessage);
      if (onError) onError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBillingChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setBillingInfo(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setBillingInfo(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  return (
    <div className="stripe-payment-form">
      <form onSubmit={handleSubmit}>
        <div className="billing-section">
          <h3>Billing Information</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                type="text"
                id="name"
                value={billingInfo.name}
                onChange={(e) => handleBillingChange('name', e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                value={billingInfo.email}
                onChange={(e) => handleBillingChange('email', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input
                type="tel"
                id="phone"
                value={billingInfo.phone}
                onChange={(e) => handleBillingChange('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="address1">Address Line 1 *</label>
              <input
                type="text"
                id="address1"
                value={billingInfo.address.line1}
                onChange={(e) => handleBillingChange('address.line1', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="address2">Address Line 2</label>
              <input
                type="text"
                id="address2"
                value={billingInfo.address.line2}
                onChange={(e) => handleBillingChange('address.line2', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="city">City *</label>
              <input
                type="text"
                id="city"
                value={billingInfo.address.city}
                onChange={(e) => handleBillingChange('address.city', e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="state">State *</label>
              <input
                type="text"
                id="state"
                value={billingInfo.address.state}
                onChange={(e) => handleBillingChange('address.state', e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="postalCode">Postal Code *</label>
              <input
                type="text"
                id="postalCode"
                value={billingInfo.address.postalCode}
                onChange={(e) => handleBillingChange('address.postalCode', e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="payment-section">
          <h3>Payment Information</h3>
          
          <div className="card-element-wrapper">
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>
        </div>

        <div className="payment-summary">
          <h3>Order Summary</h3>
          
          {pricingBreakdown ? (
            <div className="pricing-breakdown">
              <div className="breakdown-row">
                <span>Subtotal:</span>
                <span>${pricingBreakdown.subtotal.toFixed(2)}</span>
              </div>
              <div className="breakdown-row">
                <span>Shipping:</span>
                <span>${pricingBreakdown.shippingCost.toFixed(2)}</span>
              </div>
              <div className="breakdown-row">
                <span>Tax:</span>
                <span>${pricingBreakdown.tax.toFixed(2)}</span>
              </div>
              <div className="breakdown-row">
                <span>Platform Fee:</span>
                <span>${pricingBreakdown.platformFee.toFixed(2)}</span>
              </div>
              <div className="breakdown-row total-row">
                <span><strong>Total:</strong></span>
                <span><strong>${pricingBreakdown.total.toFixed(2)}</strong></span>
              </div>
            </div>
          ) : (
            <div className="amount-display">
              <strong>Total Amount: ${totalAmount.toFixed(2)}</strong>
            </div>
          )}
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!stripe || isLoading || parentIsLoading}
            className={`payment-button ${(isLoading || parentIsLoading) ? 'loading' : ''}`}
          >
            {isLoading || parentIsLoading ? 'Processing...' : `Pay $${(pricingBreakdown?.total || totalAmount).toFixed(2)}`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StripePaymentForm;
