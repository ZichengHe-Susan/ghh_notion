import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser, isEmailVerified, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!isEmailVerified) {
    return <Navigate to="/login?message=Please verify your email before accessing this page" replace />;
  }

  return children;
};

export default ProtectedRoute;
