// API service layer for backend communication
import config from '../config/environment';
import { secureLog } from '../utils/secureLogger';

const API_BASE_URL = config.API_URL;

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('token');
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  // Get authentication headers
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  // Get headers for file uploads
  getFileHeaders() {
    const headers = {};
    
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    // Log request details for debugging
    console.log('API Request:', {
      url,
      method: config.method || 'GET',
      endpoint,
      timestamp: new Date().toISOString()
    });

    try {
      const response = await fetch(url, config);
      
      console.log('API Response received:', {
        url,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        timestamp: new Date().toISOString()
      });
      
      // Handle non-JSON responses
      if (!response.headers.get('content-type')?.includes('application/json')) {
        if (response.ok) {
          return { success: true, data: await response.text() };
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          data: data,
          url: url,
          config: config
        });
        throw new Error(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('API Success Response:', {
        url,
        data,
        timestamp: new Date().toISOString()
      });

      // If the backend response already has success structure, return it directly
      if (data && typeof data === 'object' && 'success' in data) {
        return data;
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('API Request Error:', {
        url,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      return { success: false, error: error.message };
    }
  }

  // Authentication methods
  async login(email, password) {
    secureLog('Logging in user:', { email }); // Only log email, not password
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData) {
    // Log registration data securely (passwords will be redacted)
    secureLog('Registering user with data:', userData);
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout() {
    const result = await this.request('/auth/logout', {
      method: 'POST',
    });
    
    if (result.success) {
      this.setToken(null);
    }
    
    return result;
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    const result = await this.request('/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (result.success && result.data.accessToken) {
      this.setToken(result.data.accessToken);
      localStorage.setItem('refreshToken', result.data.refreshToken);
    }

    return result;
  }

  async getProfile() {
    return this.request('/auth/profile');
  }

  async resendVerification(email) {
    return this.request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Item methods
  async getItems(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/items?${queryString}` : '/items';
    return this.request(endpoint);
  }

  async getItem(id) {
    return this.request(`/items/${id}`);
  }

  async createItem(itemData) {
    return this.request('/items', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  }

  async updateItem(id, itemData) {
    return this.request(`/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(itemData),
    });
  }

  async deleteItem(id) {
    return this.request(`/items/${id}`, {
      method: 'DELETE',
    });
  }

  async searchItems(query, filters = {}) {
    const params = { q: query, ...filters };
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/items/search?${queryString}`);
  }

  async getItemCategories() {
    return this.request('/items/categories');
  }

  async getItemsBySeller(sellerId) {
    return this.request(`/items/seller/${sellerId}`);
  }

  // File upload methods
  async uploadFile(file, type = 'single') {
    const formData = new FormData();
    formData.append('file', file);

    const url = `${this.baseURL}/upload/${type}`;
    const config = {
      method: 'POST',
      headers: this.getFileHeaders(),
      body: formData,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // If the backend response already has success/data structure, return it directly
      if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
        return data;
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('File Upload Error:', error);
      return { success: false, error: error.message };
    }
  }

  async uploadMultipleFiles(files) {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const url = `${this.baseURL}/upload/multiple`;
    const config = {
      method: 'POST',
      headers: this.getFileHeaders(),
      body: formData,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // If the backend response already has success/data structure, return it directly
      if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
        return data;
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Multiple File Upload Error:', error);
      return { success: false, error: error.message };
    }
  }

  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);

    const url = `${this.baseURL}/upload/avatar`;
    const config = {
      method: 'POST',
      headers: this.getFileHeaders(),
      body: formData,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // If the backend response already has success/data structure, return it directly
      if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
        return data;
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Avatar Upload Error:', error);
      return { success: false, error: error.message };
    }
  }

  async uploadItemImages(itemId, files) {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });

    const url = `${this.baseURL}/upload/item-images/${itemId}`;
    const config = {
      method: 'POST',
      headers: this.getFileHeaders(),
      body: formData,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Item Images Upload Error:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteFile(key) {
    return this.request(`/upload/${key}`, {
      method: 'DELETE',
    });
  }

  // User methods
  async updateProfile(userData) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async updateUserInfo(userData) {
    return this.request('/users/info', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async resendEmailChangeVerification() {
    return this.request('/users/resend-email-change-verification', {
      method: 'POST',
    });
  }

  async getUserProfile(userId) {
    return this.request(`/users/${userId}`);
  }

  // Cart methods (if implemented in backend)
  async addToCart(itemId) {
    return this.request('/cart/add', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    });
  }

  async removeFromCart(itemId) {
    return this.request('/cart/remove', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    });
  }

  async getCart() {
    return this.request('/cart');
  }

  async clearCart() {
    return this.request('/cart/clear', {
      method: 'DELETE',
    });
  }

  async updateCartItemQuantity(itemId, quantity) {
    return this.request('/cart/update-quantity', {
      method: 'PUT',
      body: JSON.stringify({ itemId, quantity }),
    });
  }

  // Order methods (if implemented in backend)
  async createOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getOrders() {
    return this.request('/orders');
  }

  async getOrder(orderId) {
    return this.request(`/orders/${orderId}`);
  }

  async updateOrderStatus(orderId, status) {
    return this.request(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Chat methods (if implemented in backend)
  async getConversations() {
    return this.request('/chat/conversations');
  }

  async getConversation(conversationId) {
    return this.request(`/chat/conversations/${conversationId}`);
  }

  async getMessages(conversationId) {
    return this.request(`/chat/conversations/${conversationId}/messages`);
  }

  async createConversation(participantId, itemId) {
    return this.request('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ participantId, itemId }),
    });
  }

  // Review methods (if implemented in backend)
  async createReview(reviewData) {
    return this.request('/reviews', {
      method: 'POST',
      body: JSON.stringify(reviewData),
    });
  }

  async getReviews(itemId) {
    return this.request(`/reviews/item/${itemId}`);
  }

  async getUserReviews(userId) {
    return this.request(`/reviews/user/${userId}`);
  }

  async updateReview(reviewId, reviewData) {
    return this.request(`/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(reviewData),
    });
  }

  async deleteReview(reviewId) {
    return this.request(`/reviews/${reviewId}`, {
      method: 'DELETE',
    });
  }

  // Address methods
  async getAddresses() {
    return this.request('/addresses');
  }

  async getDefaultAddress(type = 'shipping') {
    return this.request(`/addresses/default?type=${type}`);
  }

  async getAddressById(id) {
    return this.request(`/addresses/${id}`);
  }

  async createAddress(addressData) {
    return this.request('/addresses', {
      method: 'POST',
      body: JSON.stringify(addressData),
    });
  }

  async updateAddress(id, addressData) {
    return this.request(`/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(addressData),
    });
  }

  async deleteAddress(id) {
    return this.request(`/addresses/${id}`, {
      method: 'DELETE',
    });
  }

  async setDefaultAddress(id) {
    return this.request(`/addresses/${id}/set-default`, {
      method: 'PUT',
    });
  }

  async markAddressAsUsed(id) {
    return this.request(`/addresses/${id}/mark-used`, {
      method: 'PUT',
    });
  }
}

// Create and export a singleton instance
const apiService = new ApiService();
export default apiService;
