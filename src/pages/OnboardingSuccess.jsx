import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import '../components/styles/StripeOnboarding.css';

const OnboardingSuccess = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accountStatus, setAccountStatus] = useState(null);

  useEffect(() => {
    checkAccountStatus();
  }, []);

  const checkAccountStatus = async () => {
    try {
      const response = await apiService.getStripeConnectAccountStatus();
      
      if (response.success) {
        setAccountStatus(response.data);
      }
    } catch (err) {
      console.error('Error checking account status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    navigate('/upload');
  };

  if (loading) {
    return (
      <div className="stripe-onboarding-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Verifying your account...</p>
        </div>
      </div>
    );
  }

  const isComplete = accountStatus?.onboardingStatus === 'complete' && 
                    accountStatus?.chargesEnabled && 
                    accountStatus?.payoutsEnabled;

  return (
    <div className="stripe-onboarding-container">
      <div className="onboarding-card">
        <div className="success-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#28a745"/>
            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <h1>Payment Account Setup Complete!</h1>
        
        {isComplete ? (
          <div>
            <p className="success-message">
              Congratulations! Your payment account has been successfully set up. 
              You can now start listing items for sale on our platform.
            </p>
            
            <div className="status-info">
              <div className="status-item">
                <span className="label">Account Status:</span>
                <span className="status complete">Complete</span>
              </div>
              <div className="status-item">
                <span className="label">Charges Enabled:</span>
                <span className="status enabled">Yes</span>
              </div>
              <div className="status-item">
                <span className="label">Payouts Enabled:</span>
                <span className="status enabled">Yes</span>
              </div>
            </div>
            
            <div className="actions">
              <button 
                onClick={handleContinue}
                className="primary-button"
              >
                Start Selling
              </button>
              <button 
                onClick={() => navigate('/')}
                className="secondary-button"
              >
                Back to Home
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="warning-message">
              Your account setup is still in progress. Please complete all required steps.
            </p>
            
            <div className="actions">
              <button 
                onClick={() => navigate('/seller/onboarding')}
                className="primary-button"
              >
                Complete Setup
              </button>
              <button 
                onClick={() => navigate('/')}
                className="secondary-button"
              >
                Back to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingSuccess;
