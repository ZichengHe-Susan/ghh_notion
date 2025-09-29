// Environment configuration for the frontend
const config = {
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  SOCKET_URL: process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000',
  NODE_ENV: process.env.REACT_APP_NODE_ENV || 'development',
  
  // Stripe Configuration
  STRIPE_PUBLISHABLE_KEY: process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51PFgYhQA5t6K7cQa4xMxLpJ4mM7W9nR3Q1F2H4G6B8N5S7U9W2Y4Z6A8B1C3D5',
  
  // Feature flags
  ENABLE_CHAT: true,
  ENABLE_REVIEWS: true,
  ENABLE_NOTIFICATIONS: true,
  
  // Upload settings
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  
  // Pagination
  ITEMS_PER_PAGE: 12,
  MESSAGES_PER_PAGE: 50,
  
  // Timeouts
  API_TIMEOUT: 10000, // 10 seconds
  UPLOAD_TIMEOUT: 30000, // 30 seconds
};

export default config;
