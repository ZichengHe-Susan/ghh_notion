const express = require('express');
const router = express.Router();

// Import controllers (to be created)
const {
  createPaymentIntent,
  confirmPayment,
  handleWebhook,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  processRefund
} = require('../controllers/paymentController');

// Import middleware
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// @route   POST /api/payments/create-intent
// @desc    Create payment intent
// @access  Private
router.post('/create-intent', auth, createPaymentIntent);

// @route   POST /api/payments/confirm
// @desc    Confirm payment
// @access  Private
router.post('/confirm', auth, confirmPayment);

// @route   POST /api/payments/webhook
// @desc    Handle Stripe webhook
// @access  Public
router.post('/webhook', handleWebhook);

// @route   GET /api/payments/methods
// @desc    Get user's payment methods
// @access  Private
router.get('/methods', auth, getPaymentMethods);

// @route   POST /api/payments/methods
// @desc    Add payment method
// @access  Private
router.post('/methods', auth, addPaymentMethod);

// @route   DELETE /api/payments/methods/:id
// @desc    Remove payment method
// @access  Private
router.delete('/methods/:id', auth, removePaymentMethod);

// @route   POST /api/payments/refund
// @desc    Process refund
// @access  Private/Admin
router.post('/refund', auth, authorize('admin', 'super_admin'), processRefund);

module.exports = router;
