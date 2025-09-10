const express = require('express');
const router = express.Router();

// Import controllers (to be created)
const {
  getProfile,
  updateProfile,
  deleteAccount,
  getUserItems,
  getUserOrders,
  getUserReviews,
  uploadAvatar
} = require('../controllers/userController');

// Import middleware
const auth = require('../middleware/auth');
const { validateUser } = require('../middleware/validation');

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, getProfile);

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, validateUser, updateProfile);

// @route   DELETE /api/users/profile
// @desc    Delete user account
// @access  Private
router.delete('/profile', auth, deleteAccount);

// @route   GET /api/users/items
// @desc    Get user's items
// @access  Private
router.get('/items', auth, getUserItems);

// @route   GET /api/users/orders
// @desc    Get user's orders
// @access  Private
router.get('/orders', auth, getUserOrders);

// @route   GET /api/users/reviews
// @desc    Get user's reviews
// @access  Private
router.get('/reviews', auth, getUserReviews);

// @route   POST /api/users/avatar
// @desc    Upload user avatar
// @access  Private
router.post('/avatar', auth, uploadAvatar);

module.exports = router;
