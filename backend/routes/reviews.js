const express = require('express');
const router = express.Router();

// Import controllers
const reviewController = require('../controllers/reviewController');

// Import middleware
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { 
  validateReview, 
  validateReviewUpdate, 
  validateReviewResponse, 
  validateReviewReport, 
  validateReviewModeration,
  validateReviewQuery 
} = require('../middleware/validation');

// @route   GET /api/reviews
// @desc    Get all reviews with filtering and pagination
// @access  Private
router.get('/', auth, validateReviewQuery, reviewController.getReviews);

// @route   GET /api/reviews/recent
// @desc    Get recent reviews
// @access  Private
router.get('/recent', auth, reviewController.getRecentReviews);

// @route   GET /api/reviews/top-rated
// @desc    Get top rated reviews
// @access  Private
router.get('/top-rated', auth, reviewController.getTopRatedReviews);

// @route   GET /api/reviews/analytics/stats
// @desc    Get review analytics statistics
// @access  Private/Admin
router.get('/analytics/stats', auth, authorize('admin', 'super_admin'), reviewController.getReviewStats);

// @route   GET /api/reviews/item/:itemId
// @desc    Get reviews for specific item
// @access  Private
router.get('/item/:itemId', auth, validateReviewQuery, reviewController.getItemReviews);

// @route   GET /api/reviews/user/:userId
// @desc    Get reviews by specific user
// @access  Private
router.get('/user/:userId', auth, validateReviewQuery, reviewController.getUserReviews);

// @route   GET /api/reviews/:id
// @desc    Get single review
// @access  Private
router.get('/:id', auth, reviewController.getReview);

// @route   POST /api/reviews
// @desc    Create new review
// @access  Private
router.post('/', auth, validateReview, reviewController.createReview);

// @route   PUT /api/reviews/:id
// @desc    Update review
// @access  Private
router.put('/:id', auth, validateReviewUpdate, reviewController.updateReview);

// @route   DELETE /api/reviews/:id
// @desc    Delete review
// @access  Private/Admin
router.delete('/:id', auth, authorize('admin', 'super_admin'), reviewController.deleteReview);

// @route   POST /api/reviews/:id/helpful
// @desc    Mark review as helpful
// @access  Private
router.post('/:id/helpful', auth, reviewController.markHelpful);

// @route   DELETE /api/reviews/:id/helpful
// @desc    Remove helpful vote from review
// @access  Private
router.delete('/:id/helpful', auth, reviewController.removeHelpful);

// @route   POST /api/reviews/:id/response
// @desc    Add response to review
// @access  Private
router.post('/:id/response', auth, validateReviewResponse, reviewController.addResponse);

// @route   POST /api/reviews/:id/report
// @desc    Report review
// @access  Private
router.post('/:id/report', auth, validateReviewReport, reviewController.reportReview);

module.exports = router;
