import React, { useContext, useState, useEffect, createContext, useCallback } from 'react';
import apiService from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check for existing token on app load
  useEffect(() => {
    const initializeAuth = async () => {
      // Prevent multiple initializations
      if (isInitialized) {
        return;
      }

      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (token) {
        try {
          // Verify token is still valid by getting profile
          const result = await apiService.getProfile();
          console.log('=== AuthContext Debug ===');
          console.log('API result:', result);
          if (result.success) {
            const profileData = result.data.data || result.data;
            console.log('Profile data:', profileData);
            console.log('User data:', profileData.user);
            console.log('User displayName:', profileData.user?.displayName);
            setCurrentUser({ id: profileData.user.id, email: profileData.user.email });
            setUserData(profileData.user);
            setIsEmailVerified(profileData.user.isEmailVerified || false);
          } else {
            // Token might be expired, try to refresh
            if (refreshToken) {
              const refreshResult = await apiService.refreshToken();
              if (refreshResult.success) {
                const profileResult = await apiService.getProfile();
                if (profileResult.success) {
                  const profileData = profileResult.data.data || profileResult.data;
                  setCurrentUser({ id: profileData.user.id, email: profileData.user.email });
                  setUserData(profileData.user);
                  setIsEmailVerified(profileData.user.isEmailVerified || false);
                } else {
                  // Both token and refresh failed, clear auth
                  clearAuth();
                }
              } else {
                // Refresh failed, clear auth
                clearAuth();
              }
            } else {
              // No refresh token, clear auth
              clearAuth();
            }
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          clearAuth();
        }
      }
      
      setLoading(false);
      setIsInitialized(true);
    };

    initializeAuth();
  }, [isInitialized]);

  const clearAuth = () => {
    setCurrentUser(null);
    setUserData(null);
    setIsEmailVerified(false);
    setIsInitialized(false);
    apiService.setToken(null);
    // Clear all possible token storage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    // Also clear sessionStorage as a backup
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
  };

  const login = async (email, password) => {
    try {
      const result = await apiService.login(email, password);
      
      if (result.success) {
        const { user, tokens } = result.data.data || result.data;
        
        // Set tokens
        apiService.setToken(tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        
        // Set user data
        setCurrentUser({ id: user.id, email: user.email });
        setUserData(user);
        setIsEmailVerified(user.isEmailVerified || false);
        
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const register = async (userData) => {
    try {
      const result = await apiService.register(userData);
      
      if (result.success) {
        // Don't auto-login after registration - user needs to verify email first
        return { success: true, message: result.message || 'Registration successful. Please check your email for verification.' };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      // Always try to call the backend logout endpoint
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Even if backend logout fails, we should clear local state
    } finally {
      // Always clear local authentication state
      clearAuth();
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const result = await apiService.updateProfile(profileData);
      if (result.success) {
        const responseData = result.data.data || result.data;
        const userData = responseData.user || responseData;
        setUserData(userData);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Profile update error:', error);
      return { success: false, error: error.message };
    }
  };

  const resendVerification = async (email) => {
    try {
      const result = await apiService.resendVerification(email);
      if (result.success) {
        return { success: true, message: result.message || 'Verification email sent' };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      return { success: false, error: error.message };
    }
  };

  const validateToken = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return false;
      }

      const result = await apiService.getProfile();
      console.log('=== validateToken Debug ===');
      console.log('API result in validateToken:', result);
      if (result.success) {
        const profileData = result.data.data || result.data;
        console.log('Profile data in validateToken:', profileData);
        console.log('User data in validateToken:', profileData.user);
        console.log('User displayName in validateToken:', profileData.user?.displayName);
        setCurrentUser({ id: profileData.user.id, email: profileData.user.email });
        setUserData(profileData.user);
        setIsEmailVerified(profileData.user.isEmailVerified || false);
        return true;
      } else {
        clearAuth();
        return false;
      }
    } catch (error) {
      console.error('Token validation error:', error);
      clearAuth();
      return false;
    }
  }, []);

  const updateUser = (updatedUserData) => {
    setUserData(prev => ({ ...prev, ...updatedUserData }));
  };

  const value = {
    currentUser, 
    user: userData, // Add user alias for easier access
    userData,
    isEmailVerified,
    login,
    register,
    logout,
    updateProfile,
    updateUser, // Add updateUser method
    resendVerification,
    validateToken,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} 
    </AuthContext.Provider>
  );
};
