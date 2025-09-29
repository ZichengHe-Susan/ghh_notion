import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './styles/OrderConfirmation.css';

const OrderConfirmation = () => {
  const location = useLocation();
  const { paymentResult, orderData } = location.state || {};
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [orderStatus, setOrderStatus] = useState('processing');
  const [orderDetails, setOrderDetails] = useState(null);

  useEffect(() => {
    if (paymentResult && orderData) {
      setOrderDetails(orderData);
      setOrderStatus('confirmed');
    }
  }, [paymentResult, orderData]);

  const handleTrackOrder = () => {
    if (orderDetails) {
      navigate('/orders', { state: { orderNumber: orderDetails.orderNumber } });
    }
  };

  const handleContinueShopping = () => {
    navigate('/');
  };

  if (!paymentResult || !orderDetails) {
    return (
      <div className="order-confirmation-container">
        <div className="error-state">
          <h2>❌ Payment Error</h2>
          <p>There was an issue processing your payment. Please try again.</p>
          <button onClick={() => navigate('/cart')} className="retry-button">
            Back to Cart
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="order-confirmation-container">
      <div className="confirmation-header">
        <div className="success-icon">✅</div>
        <h1>Payment Successful!</h1>
        <p className="confirmation-subtitle">
          Thank you for your purchase. Your order has been confirmed.
        </p>
      </div>

      <div className="order-summary">
        <h2>Order Summary</h2>
        
        <div className="order-details">
          <div className="detail-row">
            <span className="label">Order Number:</span>
            <span className="value">{orderDetails.orderNumber}</span>
          </div>
          
          <div className="detail-row">
            <span className="label">Payment Status:</span>
            <span className="value status-success">✅ Confirmed</span>
          </div>
          
          <div className="detail-row">
            <span className="label">Total Amount:</span>
            <span className="value amount">${orderDetails.pricing?.total?.toFixed(2)}</span>
          </div>
          
          <div className="detail-row">
            <span className="label">Payment Method:</span>
            <span className="value">
              {paymentResult.paymentIntent?.payment_method?.card?.brand?.toUpperCase()}
              •••• {paymentResult.paymentIntent?.payment_method?.card?.last4}
            </span>
          </div>
        </div>

        {orderDetails.items && (
          <div className="items-section">
            <h3>Items Ordered</h3>
            <div className="items-list">
              {orderDetails.items.map((item, index) => (
                <div key={index} className="item-row">
                  <div className="item-info">
                    <span className="item-title">{item.itemSnapshot?.title}</span>
                    <span className="item-quantity">Qty: {item.quantity}</span>
                  </div>
                  <span className="item-price">${item.price?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pricing-breakdown">
          <h3>Order Breakdown</h3>
          <div className="breakdown-item">
            <span>Subtotal:</span>
            <span>${orderDetails.pricing?.subtotal?.toFixed(2)}</span>
          </div>
          <div className="breakdown-item">
            <span>Shipping:</span>
            <span>${orderDetails.pricing?.shippingCost?.toFixed(2)}</span>
          </div>
          <div className="breakdown-item">
            <span>Tax:</span>
            <span>${orderDetails.pricing?.tax?.toFixed(2)}</span>
          </div>
          <div className="breakdown-item">
            <span>Platform Fee:</span>
            <span>${orderDetails.pricing?.platformFee?.toFixed(2)}</span>
          </div>
          <div className="breakdown-item total">
            <span>Total:</span>
            <span>${orderDetails.pricing?.total?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="next-steps">
        <h2>What's Next?</h2>
        <div className="steps-timeline">
          <div className="step">
            <div className="step-icon">📧</div>
            <div className="step-content">
              <h4>Confirmation Email</h4>
              <p>You'll receive an email confirmation shortly</p>
            </div>
          </div>
          
          <div className="step">
            <div className="step-icon">📦</div>
            <div className="step-content">
              <h4>Seller Processing</h4>
              <p>The seller will prepare and ship your items</p>
            </div>
          </div>
          
          <div className="step">
            <div className="step-icon">🚚</div>
            <div className="step-content">
              <h4>Delivery</h4>
              <p>Track your package and confirm delivery</p>
            </div>
          </div>
        </div>
      </div>

      <div className="action-buttons">
        <button onClick={handleTrackOrder} className="primary-button">
          Track Order
        </button>
        
        <button onClick={handleContinueShopping} className="secondary-button">
          Continue Shopping
        </button>
      </div>

      <div className="help-section">
        <h3>Need Help?</h3>
        <p>
          If you have any questions about your order, please contact our support team.
          You can also track your order status and communicate with the seller through your dashboard.
        </p>
      </div>
    </div>
  );
};

export default OrderConfirmation;
