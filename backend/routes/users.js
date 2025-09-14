const express = require('express');
const router = express.Router();

// Import controllers
const userController = require('../controllers/userController');

// Import middleware
const { auth } = require('../middleware/auth');
const { validateProfileUpdate, validateVerificationSubmission } = require('../middleware/validation');
const { uploadSingle } = require('../middleware/upload');

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, userController.getProfile);

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, validateProfileUpdate, userController.updateProfile);

// @route   DELETE /api/users/profile
// @desc    Delete user account
// @access  Private
router.delete('/profile', auth, userController.deleteAccount);

// @route   GET /api/users/dashboard
// @desc    Get user dashboard data
// @access  Private
router.get('/dashboard', auth, userController.getDashboard);

// @route   GET /api/users/items
// @desc    Get user's items
// @access  Private
router.get('/items', auth, userController.getUserItems);

// @route   GET /api/users/orders
// @desc    Get user's orders
// @access  Private
router.get('/orders', auth, userController.getUserOrders);

// @route   GET /api/users/reviews
// @desc    Get user's reviews
// @access  Private
router.get('/reviews', auth, userController.getUserReviews);

// @route   POST /api/users/avatar
// @desc    Upload user avatar
// @access  Private
router.post('/avatar', auth, uploadSingle('avatar'), userController.uploadAvatar);

// @route   POST /api/users/verification
// @desc    Submit seller verification documents
// @access  Private
router.post('/verification', auth, validateVerificationSubmission, userController.submitVerification);

// @route   GET /api/users/verification
// @desc    Get verification status
// @access  Private
router.get('/verification', auth, userController.getVerificationStatus);

module.exports = router;
