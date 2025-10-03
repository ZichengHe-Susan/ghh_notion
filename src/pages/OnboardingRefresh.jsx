import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import '../components/styles/StripeOnboarding.css';

const OnboardingRefresh = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect back to onboarding page after a short delay
    const timer = setTimeout(() => {
      navigate('/seller/onboarding');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="stripe-onboarding-container">
      <div className="onboarding-card">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Refreshing your account status...</p>
          <p className="small-text">You will be redirected shortly.</p>
        </div>
      </div>
    </div>
  );
};

export default OnboardingRefresh;
