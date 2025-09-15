const express = require('express');
const router = express.Router();

// Import controllers
const escrowController = require('../controllers/escrowController');

// Import middleware
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { body, param, query } = require('express-validator');

// Validation middleware
const validateReleaseEscrow = [
  body('orderId').isMongoId().withMessage('Valid order ID is required')
];

const validateAutoReleaseEscrow = [
  body('orderId').isMongoId().withMessage('Valid order ID is required')
];

const validateEscrowRefund = [
  body('orderId').isMongoId().withMessage('Valid order ID is required'),
  body('refundAmount').optional().isFloat({ min: 0.01 }).withMessage('Refund amount must be greater than 0'),
  body('reason').optional().isIn(['duplicate', 'fraudulent', 'requested_by_customer', 'admin_dispute_resolution']).withMessage('Valid refund reason is required')
];

const validateInitiateDispute = [
  body('orderId').isMongoId().withMessage('Valid order ID is required'),
  body('reason').isString().isLength({ min: 5, max: 200 }).withMessage('Dispute reason is required'),
  body('description').isString().isLength({ min: 10, max: 1000 }).withMessage('Dispute description is required')
];

const validateResolveDispute = [
  body('orderId').isMongoId().withMessage('Valid order ID is required'),
  body('resolution').isIn(['release_to_seller', 'refund_to_buyer']).withMessage('Valid resolution is required'),
  body('notes').isString().isLength({ min: 5, max: 500 }).withMessage('Resolution notes are required')
];

const validateEscrowStats = [
  query('sellerId').optional().isMongoId().withMessage('Valid seller ID is required'),
  query('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  query('endDate').optional().isISO8601().withMessage('Valid end date is required')
];

const validateDisputedOrders = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['pending', 'held', 'released', 'disputed', 'refunded']).withMessage('Valid escrow status is required')
];

const validateUserEscrowOrders = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['pending', 'held', 'released', 'disputed', 'refunded']).withMessage('Valid escrow status is required')
];

// @route   POST /api/escrow/release
// @desc    Release escrow funds to seller (buyer confirmation)
// @access  Private
router.post('/release', auth, validateReleaseEscrow, escrowController.releaseEscrowToSeller);

// @route   POST /api/escrow/auto-release
// @desc    Auto-release escrow funds after timeout period
// @access  Private (Admin only)
router.post('/auto-release', auth, authorize(['admin', 'super_admin']), validateAutoReleaseEscrow, escrowController.autoReleaseEscrow);

// @route   POST /api/escrow/refund
// @desc    Process escrow refund to buyer
// @access  Private (Admin only)
router.post('/refund', auth, authorize(['admin', 'super_admin']), validateEscrowRefund, escrowController.processEscrowRefund);

// @route   POST /api/escrow/dispute
// @desc    Initiate a dispute for an order
// @access  Private
router.post('/dispute', auth, validateInitiateDispute, escrowController.initiateDispute);

// @route   POST /api/escrow/resolve-dispute
// @desc    Resolve a dispute (admin only)
// @access  Private (Admin only)
router.post('/resolve-dispute', auth, authorize(['admin', 'super_admin']), validateResolveDispute, escrowController.resolveDispute);

// @route   GET /api/escrow/pending-auto-release
// @desc    Get orders pending auto-release
// @access  Private (Admin only)
router.get('/pending-auto-release', auth, authorize(['admin', 'super_admin']), escrowController.getPendingAutoReleaseOrders);

// @route   POST /api/escrow/process-auto-releases
// @desc    Process all pending auto-releases
// @access  Private (Admin only)
router.post('/process-auto-releases', auth, authorize(['admin', 'super_admin']), escrowController.processPendingAutoReleases);

// @route   GET /api/escrow/stats
// @desc    Get escrow statistics
// @access  Private (Admin only)
router.get('/stats', auth, authorize(['admin', 'super_admin']), validateEscrowStats, escrowController.getEscrowStats);

// @route   GET /api/escrow/disputed-orders
// @desc    Get disputed orders
// @access  Private (Admin only)
router.get('/disputed-orders', auth, authorize(['admin', 'super_admin']), validateDisputedOrders, escrowController.getDisputedOrders);

// @route   GET /api/escrow/:orderId
// @desc    Get escrow details for an order
// @access  Private
router.get('/:orderId', auth, escrowController.getEscrowDetails);

// @route   GET /api/escrow/user/orders
// @desc    Get user's escrow orders
// @access  Private
router.get('/user/orders', auth, validateUserEscrowOrders, escrowController.getUserEscrowOrders);

module.exports = router;
