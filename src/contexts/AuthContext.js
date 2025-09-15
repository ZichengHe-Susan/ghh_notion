import React, { useContext, useState, useEffect, createContext } from 'react';
import apiService from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); 
  const [loading, setLoading] = useState(true);

  // Check for existing token on app load
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (token) {
        try {
          // Verify token is still valid by getting profile
          const result = await apiService.getProfile();
          if (result.success) {
            const profileData = result.data.data || result.data;
            setCurrentUser({ id: profileData.user.id, email: profileData.user.email });
            setUserData(profileData.user);
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
    };

    initializeAuth();
  }, []);

  const clearAuth = () => {
    setCurrentUser(null);
    setUserData(null);
    apiService.setToken(null);
    localStorage.removeItem('refreshToken');
  };

  const login = async (email, password) => {
    try {
      const result = await apiService.login(email, password);
      ////console.log('Full login result:', JSON.stringify(result, null, 2));
      
      if (result.success) {
        //console.log('Result data:', JSON.stringify(result.data, null, 2));

        const { user, tokens } = result.data.data || result.data;
        //console.log('Destructured user:', user);
        //console.log('Destructured tokens:', tokens);
        
        // Set tokens
        apiService.setToken(tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        
        // Set user data
        setCurrentUser({ id: user.id, email: user.email });
        setUserData(user);
        
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
        const { user, tokens } = result.data.data || result.data;
        
        // Set tokens
        apiService.setToken(tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
        
        // Set user data
        setCurrentUser({ id: user.id, email: user.email });
        setUserData(user);
        
        return { success: true };
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
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
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

  const value = {
    currentUser, 
    userData,
    login,
    register,
    logout,
    updateProfile,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} 
    </AuthContext.Provider>
  );
};
