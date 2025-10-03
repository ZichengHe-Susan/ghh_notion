import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './styles/StripeOnboarding.css';

const StripeOnboarding = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accountStatus, setAccountStatus] = useState(null);
  const [onboardingUrl, setOnboardingUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAccountStatus();
  }, []);

  const checkAccountStatus = async () => {
    try {
      setLoading(true);
      const response = await apiService.getStripeConnectAccountStatus();
      
      if (response.success) {
        setAccountStatus(response.data);
        
        // If account is complete, redirect to success
        if (response.data.onboardingStatus === 'complete' && 
            response.data.chargesEnabled && 
            response.data.payoutsEnabled) {
          navigate('/seller/onboarding/success');
        }
      } else {
        // If no account exists, show create account option
        setAccountStatus(null);
      }
    } catch (err) {
      console.error('Error checking account status:', err);
      setError('Failed to check account status');
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.createStripeConnectAccount({
        country: 'US',
        businessType: 'individual'
      });
      
      if (response.success) {
        setOnboardingUrl(response.data.onboardingUrl);
        // Redirect to Stripe onboarding
        window.location.href = response.data.onboardingUrl;
      } else {
        setError(response.error || 'Failed to create account');
      }
    } catch (err) {
      console.error('Error creating account:', err);
      setError('Failed to create Stripe account');
    } finally {
      setLoading(false);
    }
  };

  const continueOnboarding = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.createStripeConnectLink('account_onboarding');
      
      if (response.success) {
        window.location.href = response.data.url;
      } else {
        setError(response.error || 'Failed to create onboarding link');
      }
    } catch (err) {
      console.error('Error creating onboarding link:', err);
      setError('Failed to continue onboarding');
    } finally {
      setLoading(false);
    }
  };

  const updateAccount = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.createStripeConnectLink('account_update');
      
      if (response.success) {
        window.location.href = response.data.url;
      } else {
        setError(response.error || 'Failed to create update link');
      }
    } catch (err) {
      console.error('Error creating update link:', err);
      setError('Failed to update account');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="stripe-onboarding-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stripe-onboarding-container">
      <div className="onboarding-card">
        <h1>Seller Payment Setup</h1>
        <p className="description">
          To start selling on our platform, you need to set up a payment account with Stripe. 
          This allows you to receive payments from buyers securely.
        </p>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {!accountStatus ? (
          <div className="no-account">
            <h2>Create Your Payment Account</h2>
            <p>You don't have a payment account yet. Let's create one!</p>
            <p className="info-text">
              You'll be redirected to Stripe's secure onboarding process where you can provide your phone number and other required information.
            </p>
            
            <button 
              onClick={createAccount}
              disabled={loading}
              className="primary-button"
            >
              Create Payment Account
            </button>
          </div>
        ) : (
          <div className="account-status">
            <h2>Account Status</h2>
            
            <div className="status-info">
              <div className="status-item">
                <span className="label">Onboarding Status:</span>
                <span className={`status ${accountStatus.onboardingStatus}`}>
                  {accountStatus.onboardingStatus}
                </span>
              </div>
              
              <div className="status-item">
                <span className="label">Charges Enabled:</span>
                <span className={`status ${accountStatus.chargesEnabled ? 'enabled' : 'disabled'}`}>
                  {accountStatus.chargesEnabled ? 'Yes' : 'No'}
                </span>
              </div>
              
              <div className="status-item">
                <span className="label">Payouts Enabled:</span>
                <span className={`status ${accountStatus.payoutsEnabled ? 'enabled' : 'disabled'}`}>
                  {accountStatus.payoutsEnabled ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            {accountStatus.requirements && (
              <div className="requirements">
                <h3>Requirements</h3>
                {accountStatus.requirements.currentlyDue?.length > 0 && (
                  <div className="requirement-section">
                    <h4>Currently Due:</h4>
                    <ul>
                      {accountStatus.requirements.currentlyDue.map((req, index) => (
                        <li key={index}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {accountStatus.requirements.pastDue?.length > 0 && (
                  <div className="requirement-section">
                    <h4>Past Due:</h4>
                    <ul>
                      {accountStatus.requirements.pastDue.map((req, index) => (
                        <li key={index}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="actions">
              {accountStatus.onboardingStatus === 'incomplete' && (
                <button 
                  onClick={continueOnboarding}
                  disabled={loading}
                  className="primary-button"
                >
                  Continue Onboarding
                </button>
              )}
              
              {accountStatus.onboardingStatus === 'complete' && 
               (!accountStatus.chargesEnabled || !accountStatus.payoutsEnabled) && (
                <button 
                  onClick={updateAccount}
                  disabled={loading}
                  className="secondary-button"
                >
                  Update Account
                </button>
              )}
              
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

export default StripeOnboarding;
