const express = require('express');
const router = express.Router();

// Import controllers (placeholder for now)
const reviewController = require('../controllers/reviewController');

// Import middleware
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { validateReview } = require('../middleware/validation');

// @route   GET /api/reviews
// @desc    Get all reviews
// @access  Public
router.get('/', reviewController.getReviews);

// @route   GET /api/reviews/item/:itemId
// @desc    Get reviews for specific item
// @access  Public
router.get('/item/:itemId', reviewController.getItemReviews);

// @route   GET /api/reviews/user/:userId
// @desc    Get reviews by specific user
// @access  Public
router.get('/user/:userId', reviewController.getUserReviews);

// @route   GET /api/reviews/:id
// @desc    Get single review
// @access  Public
router.get('/:id', reviewController.getReview);

// @route   POST /api/reviews
// @desc    Create new review
// @access  Private
router.post('/', auth, reviewController.createReview);

// @route   PUT /api/reviews/:id
// @desc    Update review
// @access  Private
router.put('/:id', auth, reviewController.updateReview);

// @route   DELETE /api/reviews/:id
// @desc    Delete review
// @access  Private/Admin
router.delete('/:id', auth, authorize('admin', 'super_admin'), reviewController.deleteReview);

module.exports = router;
