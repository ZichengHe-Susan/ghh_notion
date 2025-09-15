const express = require('express');
const router = express.Router();

// Import controllers
const paymentController = require('../controllers/paymentController');

// Import middleware
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { verifyStripeWebhook, parseStripeWebhookBody, logStripeWebhook, handleWebhookIdempotency, validateWebhookEvent, handleWebhookError } = require('../middleware/webhook');
const { body, param, query } = require('express-validator');

// Validation middleware
const validateCreatePaymentIntent = [
  body('orderId').isMongoId().withMessage('Valid order ID is required'),
  body('paymentMethod.type').isIn(['card', 'bank_transfer', 'digital_wallet']).withMessage('Valid payment method type is required'),
  body('paymentMethod.card.brand').optional().isString(),
  body('paymentMethod.card.last4').optional().isString().isLength({ min: 4, max: 4 }),
  body('paymentMethod.card.expMonth').optional().isInt({ min: 1, max: 12 }),
  body('paymentMethod.card.expYear').optional().isInt({ min: new Date().getFullYear() }),
  body('billingDetails.name').isString().isLength({ min: 2, max: 100 }).withMessage('Name is required'),
  body('billingDetails.email').isEmail().withMessage('Valid email is required'),
  body('billingDetails.phone').optional().isString(),
  body('billingDetails.address.line1').isString().isLength({ min: 5, max: 200 }).withMessage('Address line 1 is required'),
  body('billingDetails.address.line2').optional().isString().isLength({ max: 200 }),
  body('billingDetails.address.city').isString().isLength({ min: 2, max: 100 }).withMessage('City is required'),
  body('billingDetails.address.state').isString().isLength({ min: 2, max: 100 }).withMessage('State is required'),
  body('billingDetails.address.postalCode').isString().isLength({ min: 3, max: 20 }).withMessage('Postal code is required'),
  body('billingDetails.address.country').isString().isLength({ min: 2, max: 100 }).withMessage('Country is required')
];

const validateConfirmPayment = [
  body('paymentIntentId').isString().isLength({ min: 1 }).withMessage('Payment intent ID is required'),
  body('paymentMethodId').isString().isLength({ min: 1 }).withMessage('Payment method ID is required')
];

const validateAddPaymentMethod = [
  body('paymentMethodId').isString().isLength({ min: 1 }).withMessage('Payment method ID is required')
];

const validateProcessRefund = [
  body('orderId').isMongoId().withMessage('Valid order ID is required'),
  body('amount').optional().isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('reason').optional().isIn(['duplicate', 'fraudulent', 'requested_by_customer', 'admin_dispute_resolution']).withMessage('Valid refund reason is required')
];

const validatePaymentHistory = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'canceled', 'failed']).withMessage('Valid status is required')
];

const validatePaymentStats = [
  query('sellerId').optional().isMongoId().withMessage('Valid seller ID is required'),
  query('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  query('endDate').optional().isISO8601().withMessage('Valid end date is required')
];

// @route   POST /api/payments/create-intent
// @desc    Create payment intent
// @access  Private
router.post('/create-intent', auth, validateCreatePaymentIntent, paymentController.createPaymentIntent);

// @route   POST /api/payments/confirm
// @desc    Confirm payment
// @access  Private
router.post('/confirm', auth, validateConfirmPayment, paymentController.confirmPayment);

// @route   POST /api/payments/webhook
// @desc    Handle Stripe webhooks
// @access  Public (Stripe only)
router.post('/webhook', 
  parseStripeWebhookBody,
  verifyStripeWebhook,
  logStripeWebhook,
  handleWebhookIdempotency,
  validateWebhookEvent,
  paymentController.handleWebhook,
  handleWebhookError
);

// @route   GET /api/payments/methods
// @desc    Get user's payment methods
// @access  Private
router.get('/methods', auth, paymentController.getPaymentMethods);

// @route   POST /api/payments/methods
// @desc    Add payment method
// @access  Private
router.post('/methods', auth, validateAddPaymentMethod, paymentController.addPaymentMethod);

// @route   DELETE /api/payments/methods/:paymentMethodId
// @desc    Remove payment method
// @access  Private
router.delete('/methods/:paymentMethodId', auth, paymentController.removePaymentMethod);

// @route   POST /api/payments/refund
// @desc    Process refund
// @access  Private (Admin only)
router.post('/refund', auth, authorize(['admin', 'super_admin']), validateProcessRefund, paymentController.processRefund);

// @route   GET /api/payments/:paymentIntentId
// @desc    Get payment details
// @access  Private
router.get('/:paymentIntentId', auth, paymentController.getPaymentDetails);

// @route   GET /api/payments/history
// @desc    Get user's payment history
// @access  Private
router.get('/history', auth, validatePaymentHistory, paymentController.getPaymentHistory);

// @route   GET /api/payments/stats
// @desc    Get payment statistics
// @access  Private (Admin only)
router.get('/stats', auth, authorize(['admin', 'super_admin']), validatePaymentStats, paymentController.getPaymentStats);

module.exports = router;